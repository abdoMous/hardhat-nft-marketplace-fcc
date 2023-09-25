// SPDX-License-Identifier: MIT

// Layout of Contract:
// version
// imports
// interfaces, libraries, contracts
// errors
// Type declarations
// State variables
// Events
// Modifiers
// Functions

// Layout of Functions:
// constructor
// receive function (if exists)
// fallback function (if exists)
// external
// public
// internal
// private
// view & pure functions

pragma solidity ^0.8.7;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// todo add explanation
contract NftMarketplace is ReentrancyGuard {
    ////////////
    // Errors //
    ////////////

    error NftMarketplace__PriceMustBeAboveZero();
    error NftMarketplace__NotApprovedForMarketplace();
    error NftMarketplace__AlreadyListed(address nftAddress, uint256 tokenId);
    error NftMarketplace__NotOwner();
    error NftMarketplace__NotListed(address nftAddress, uint256 tokenId);
    error NftMarketplace__PriceNotMet(address nftAddress, uint256 tokenId, uint256 price);
    error NftMarketplace__NotProceeds();
    error NftMarketplace__TransferFailed();

    ////////////
    // Types //
    ////////////

    struct Listing {
        uint256 price;
        address seller;
    }

    /////////////////////
    // State Variables //
    /////////////////////

    // NFT contract address -> NFT TokenId -> Listing
    mapping(address => mapping(uint256 => Listing)) private s_listings;

    // Seller Address -> Amount earned
    mapping(address => uint256) private s_proceeds;

    ////////////
    // Events //
    ////////////

    event ItemListed(address indexed seller, address indexed nftAddress, uint256 indexed tokenId, uint256 price);
    event ItemBought(address indexed buyer, address indexed nftAddress, uint256 indexed tokenId, uint256 price);
    event ItemCanceled(address indexed seller, address indexed nftAddress, uint256 indexed tokenId);

    ////////////////
    // Modifiers //
    ///////////////
    modifier notListed(address nftAddress, uint256 toknId, address owner) {
        Listing memory listing = s_listings[nftAddress][toknId];
        if (listing.price > 0) {
            revert NftMarketplace__AlreadyListed(nftAddress, toknId);
        }
        _;
    }

    modifier isOwner(address nftAddress, uint256 tokenId, address spender) {
        IERC721 nft = IERC721(nftAddress);
        address owner = nft.ownerOf(tokenId);
        if (spender != owner) {
            revert NftMarketplace__NotOwner();
        }
        _;
    }

    modifier isListed(address nftAddress, uint256 tokenId) {
        Listing memory listing = s_listings[nftAddress][tokenId];
        if (listing.price <= 0) {
            revert NftMarketplace__NotListed(nftAddress, tokenId);
        }
        _;
    }

    ///////////////
    // Functions //
    ///////////////

    /////////////////////////
    // External Functions //
    ////////////////////////

    /// @notice Method for listing your NFT on the marketplace
    /// @dev contract users can still hold their NFTs listed, but give the contract the ability to transfaire it / sell it.
    /// @param nftAddress: Address of the NFT
    /// @param tokenId: The token ID of the NFT
    /// @param price: sale price of the listed NFT
    function listItem(address nftAddress, uint256 tokenId, uint256 price)
        external
        notListed(nftAddress, tokenId, msg.sender)
        isOwner(nftAddress, tokenId, msg.sender)
    {
        if (price <= 0) {
            revert NftMarketplace__PriceMustBeAboveZero();
        }

        IERC721 nft = IERC721(nftAddress);
        if (nft.getApproved(tokenId) != address(this)) {
            revert NftMarketplace__NotApprovedForMarketplace();
        }

        s_listings[nftAddress][tokenId] = Listing(price, msg.sender);
        emit ItemListed(msg.sender, nftAddress, tokenId, price);
    }

    function buyItem(address nftAddress, uint256 tokenId) external payable nonReentrant isListed(nftAddress, tokenId) {
        Listing memory listedItem = s_listings[nftAddress][tokenId];
        if (msg.value < listedItem.price) {
            revert NftMarketplace__PriceNotMet(nftAddress, tokenId, listedItem.price);
        }
        s_proceeds[listedItem.seller] = s_proceeds[listedItem.seller] + msg.value;
        delete (s_listings[nftAddress][tokenId]);
        IERC721(nftAddress).safeTransferFrom(listedItem.seller, msg.sender, tokenId);
        emit ItemBought(msg.sender, nftAddress, tokenId, listedItem.price);

        // check to make sure nft transfared
    }

    function cancelListing(address nftAddress, uint256 tokenId)
        external
        isOwner(nftAddress, tokenId, msg.sender)
        isListed(nftAddress, tokenId)
    {
        delete (s_listings[nftAddress][tokenId]);
        emit ItemCanceled(msg.sender, nftAddress, tokenId);
    }

    function updateListing(address nftAddress, uint256 tokenId, uint256 newPrice)
        external
        isListed(nftAddress, tokenId)
        isOwner(nftAddress, tokenId, msg.sender)
    {
        s_listings[nftAddress][tokenId].price = newPrice;
        emit ItemListed(msg.sender, nftAddress, tokenId, newPrice);
    }

    function withdrawProceeds() external {
        uint256 proceeds = s_proceeds[msg.sender];
        if (proceeds <= 0) {
            revert NftMarketplace__NotProceeds();
        }
        s_proceeds[msg.sender] = 0;
        (bool success,) = payable(msg.sender).call{value: proceeds}("");
        if (!success) {
            revert NftMarketplace__TransferFailed();
        }
    }

    //////////////////////////////////////
    // Public & External View Functions //
    /////////////////////////////////////
    function getListing(address nftAddress, uint256 tokenId) external view returns (Listing memory) {
        return s_listings[nftAddress][tokenId];
    }

    function getProceeds(address seller) external view returns (uint256) {
        return s_proceeds[seller];
    }
}
