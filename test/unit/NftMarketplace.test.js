const { assert, expect } = require("chai")

const { network, deployments, ethers } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Nft Market place Test", function () {
          let nftMarketplace, basicNft, deployer, player
          const PRICE = ethers.utils.parseEther("0.1")
          const TOKEN_ID = 0

          beforeEach(async function () {
              const accounts = await ethers.getSigners()
              deployer = accounts[0]
              player = accounts[1]
              await deployments.fixture(["all"])
              nftMarketplaceContract = await ethers.getContract("NftMarketplace")
              nftMarketplace = nftMarketplaceContract.connect(deployer)
              basicNftContract = await ethers.getContract("BasicNft")
              basicNft = basicNftContract.connect(deployer)
              await basicNft.mintNft()
              await basicNft.approve(nftMarketplace.address, TOKEN_ID)
          })

          describe("listItem", function () {
              it("listing should be feiled when the price is 0 or below", async function () {
                  const priceZero = ethers.utils.parseEther("0")

                  await expect(
                      nftMarketplace.listItem(basicNft.address, TOKEN_ID, priceZero)
                  ).to.be.revertedWith("PriceMustBeAboveZero")
              })

              it("listing should be feiled when the nft not approved", async function () {
                  await basicNft.mintNft()
                  const not_approved_toke_id = (await basicNft.getTokenCounter()) - 1

                  await expect(
                      nftMarketplace.listItem(
                          basicNft.address,
                          not_approved_toke_id.toString(),
                          PRICE
                      )
                  ).to.be.revertedWith("NotApprovedForMarketplace")
              })

              it("emit an event after listing an item", async function () {
                  await expect(nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)).to.emit(
                      nftMarketplace,
                      "ItemListed"
                  )
              })
              it("exclusively items that haven't been listed", async () => {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  const error = `AlreadyListed("${basicNft.address}", ${TOKEN_ID})`
                  await expect(
                      nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  ).to.revertedWith(error)
              })
              it("exclusively allows owners to list", async () => {
                  const playerConnectedNftMarketplace = nftMarketplace.connect(player)
                  await expect(
                      playerConnectedNftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  ).to.revertedWith("NotOwner")
              })
              it("update listing with seller and price", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  const listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID)
                  assert(listing.price.toString() == PRICE.toString())
                  assert(listing.seller.toString() == deployer.address)
              })
          })

          describe("buyItem", function () {
              it("reverts if the item isnt listed", async function () {
                  await expect(
                      nftMarketplace.buyItem(basicNft.address, TOKEN_ID)
                  ).to.be.revertedWith("NotListed")
              })
              it("reverts if the price isnt met", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  await expect(
                      nftMarketplace.buyItem(basicNft.address, TOKEN_ID)
                  ).to.be.revertedWith("PriceNotMet")
              })
              it("listing and can be bought", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)

                  const playerConnectedNftMarketplace = nftMarketplace.connect(player)
                  await playerConnectedNftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
                      value: PRICE,
                  })
                  const newOwner = await basicNft.ownerOf(TOKEN_ID)
                  const deployerProceeds = await nftMarketplace.getProceeds(deployer.address)

                  assert(newOwner.toString() == player.address)
                  assert(deployerProceeds.toString() == PRICE.toString())
              })

              it("should emit an event after the item bought", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  const playerConnectedNftMarketplace = nftMarketplace.connect(player)

                  await expect(
                      await playerConnectedNftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
                          value: PRICE,
                      })
                  ).to.emit(nftMarketplace, "ItemBought")
              })
          })

          describe("cancelListing", function () {
              it("should cancel listing", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  await nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)
                  const listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID)
                  assert(listing.seller === ethers.constants.AddressZero)
              })

              it("should emit an event after cancel listing", async () => {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  expect(nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)).to.emit(
                      nftMarketplace,
                      "ItemCanceled"
                  )
              })
              it("reverts if there is no listing", async function () {
                  const error = `NotListed("${basicNft.address}", ${TOKEN_ID})`
                  await expect(
                      nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)
                  ).to.revertedWith(error)
              })
              it("reverts if anyone but the owner tries to call", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  const playerConnectedNftMarketplace = nftMarketplace.connect(player)
                  await expect(
                      playerConnectedNftMarketplace.cancelListing(basicNft.address, TOKEN_ID)
                  )
              })
          })

          describe("updateListing", () => {
              it("update listing price", async () => {
                  const newPrice = ethers.utils.parseEther("0.2")

                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  await nftMarketplace.updateListing(basicNft.address, TOKEN_ID, newPrice)

                  const listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID)
                  assert.equal(listing.price, newPrice.toString())
              })
              it("must be owner and listed", async function () {})
              it("emits an event after update the price ", async function () {
                  const newPrice = ethers.utils.parseEther("0.2")

                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  expect(
                      nftMarketplace.updateListing(basicNft.address, TOKEN_ID, newPrice)
                  ).to.emit(nftMarketplace, "ItemListed")
              })
          })

          describe("withdrawProceeds", function () {
              it("should reverts when there is no proceeds", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)

                  const playerConnectedNftMarketplace = nftMarketplace.connect(player)
                  expect(playerConnectedNftMarketplace.withdrawProceeds()).to.be.revertedWith(
                      "NotProceeds"
                  )
              })
              it("should withdraw", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  const playerConnectedNftMarketplace = nftMarketplace.connect(player)
                  await playerConnectedNftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
                      value: PRICE,
                  })
                  await nftMarketplace.withdrawProceeds()
                  const buyerProceedsAfterWithdraw =
                      await playerConnectedNftMarketplace.getProceeds(player.address)
                  assert.equal(buyerProceedsAfterWithdraw, "0")
              })
          })
      })
