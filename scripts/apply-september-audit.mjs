import { readFile, writeFile } from "node:fs/promises";

const auditDate = "2026-09-04";
const primaryPath = new URL("../app/apartments.json", import.meta.url);
const expandedPath = new URL("../app/apartments-expanded.json", import.meta.url);

const corrections = {
  "atlantic-bridgemill": {
    auditStatus: "limited_public_data",
    auditNote: "The official site currently asks visitors to call for 1BR pricing. The 2BR range is official; the rent concession is community-supplied.",
    oneBed: { min: null, max: null, note: "1BR plans exist, but no public price is currently shown; call for availability." },
    twoBed: { min: 1549, max: 1870, note: "Official available-unit starting-rent range." },
    deal: "1 month free",
    dealDetail: "Community-supplied listing: move in by September 12, 2026; unit and lease restrictions apply. The official site separately offers half off application/admin fees when a prospect tours and applies within 24 hours, credited at move-in; no public end date was shown.",
    security: ["Gated entry", "24-hour emergency maintenance"],
    petCost: "Up to 2 pets, no weight limit; $300 fee + $25/month per pet; breed restrictions.",
  },
  "the-darby": {
    auditStatus: "official",
    auditNote: "Current rents and property details were rechecked; the lower 1BR is marked coming soon.",
    petCost: "Up to 2 pets; first pet $250 fee + $250 deposit, second $150 fee + $150 deposit; $25/month per pet; aggressive or bite-history dogs excluded.",
    fees: ["Application: $100 per applicant", "Administration: $175 per apartment", "Deposit: $500", "First pet: $250 fee + $250 deposit", "Second pet: $150 fee + $150 deposit", "Pet rent: $25/month per pet"],
  },
  "sixes-ridge": {
    auditStatus: "official",
    auditNote: "Official rents were rechecked. Promotion and pet terms are from the current community-supplied listing.",
    oneBed: { min: 1365, max: 1456, note: "Official available-unit starting-rent range." },
    twoBed: { min: 1670, max: 2320, note: "Official available-unit range; the upper end includes carriage-home layouts." },
    deal: "Up to 2 months free",
    dealDetail: "Community-supplied listing: 1.5 months free plus an additional half month for move-in by September 30, 2026; new residents only, transfers excluded, and other restrictions apply.",
    dealExpires: "2026-09-30",
    security: ["Smart-home features", "On-site management"],
    petCost: "Community-supplied terms: up to 3 pets; $25/month per pet; $350 dog fee and $0 cat fee shown; confirm before applying.",
    _delete: ["detectedDeal", "dealLastSeenAt", "dealStatus"],
  },
  "linz-holly-springs": {
    auditStatus: "official",
    auditNote: "Current available-unit ranges, promotion, amenities, access features, pets, and review snapshot were rechecked.",
  },
  "heights-holly-springs": {
    auditStatus: "source_conflict",
    auditNote: "Official plan-start pricing and the linked current inventory differed during the audit; call for an exact unit quote.",
    oneBed: { min: 1550, max: 2540, note: "Official plan-start snapshot; linked inventory simultaneously showed about $1,685–$2,570." },
    twoBed: { min: 2030, max: 2405, note: "Official plan-start snapshot; linked inventory simultaneously showed about $1,980–$2,405." },
    priceSource: "Official plan-start snapshot; linked inventory conflicts",
    priceConfidence: "conflict",
    security: ["Controlled access reported by the community-supplied listing", "Secure package room"],
  },
  "the-indigo": {
    auditStatus: "source_conflict",
    auditNote: "The official feed and community-supplied inventory show different starting rents; both are linked for verification.",
    oneBed: { min: 1560, max: 1650, note: "Official featured-unit range; a community-supplied feed started at $1,429." },
    twoBed: { min: 1699, max: 2030, note: "Official featured-unit range; other public feeds differed." },
    dealDetail: "Community-supplied listing: up to eight weeks free on select homes leased by September 18, 2026; confirm lease length and unit eligibility.",
    security: ["Gated community reported by the community-supplied listing", "Key-fob access reported by the community-supplied listing"],
    pricingUrl: "https://www.liveattheindigo.com/floor-plans",
  },
  "avonlea-springs": {
    auditStatus: "official",
    auditNote: "Rents, promotion, gated entry, pet terms, and mandatory-fee disclosure were rechecked.",
    fees: ["Mandatory water/trash/pest package: $57–$67/month", "Utility-account activation: $30", "Pet fee: $400 first + $100 second", "Pet rent: $15/month each", "Pet screening: $30"],
  },
  "heights-ridgewalk": {
    auditStatus: "limited_public_data",
    auditNote: "Prices, deal, fees, and reviews are a current community-supplied snapshot; the official site confirms amenities and pet rules.",
    oneBed: { min: 1537, max: 1762, note: "Community-supplied available-unit base-rent range." },
    twoBed: { min: 2110, max: 2356, note: "Community-supplied available-unit base-rent range." },
    dealDetail: "Community-supplied offer: up to four weeks free when leasing within 48 hours of touring; confirm the participating unit and term.",
    fees: ["Mandatory fixed fees: $81.59/month", "Utility billing: $10/month", "Liability: $16.59/month", "Amenity: $20/month", "Trash: $30/month", "Pest: $5/month", "Application: $85 per applicant", "Administration: $200", "Standard deposit: $250; conditional deposit may be $500–$3,500"],
    _delete: ["sourceCheckError"],
  },
  "view-at-woodstock": {
    auditStatus: "limited_public_data",
    auditNote: "The official page showed unit-specific specials without public terms, so no quantified concession is presented.",
    twoBed: { min: 1890, max: null, note: "Official starting rent; visible units reached $2,085, but the complete maximum was not reproducible." },
    deal: null,
    dealDetail: "Official inventory marks select units with a special offer but does not publish a dollar amount, duration, or eligibility terms. Ask the leasing office for a written offer.",
    dealExpires: null,
    security: ["Smart-home technology", "On-site management"],
    fees: ["Application: $100 per applicant", "Administration: $250 per apartment", "Dog fee reported: $400", "Pet rent reported: $25/month"],
    _delete: ["detectedDeal", "dealLastSeenAt", "dealStatus"],
  },
  "lea-woodstock": {
    auditStatus: "source_conflict",
    auditNote: "Available-unit starts differed across the official browser, search index, and RentCafe during the audit.",
    oneBed: { min: 1441, max: 1706, note: "Current available-unit starting rents observed on the official site; sources shifted during the audit." },
    twoBed: { min: 1760, max: 2050, note: "Current available-unit starting rents observed on the official site; sources shifted during the audit." },
    priceSource: "Official available-unit snapshot; current sources differed",
    priceConfidence: "conflict",
    dealDetail: "No broad rent concession verified. A named-employer program may waive application and administration fees for eligible employees.",
    fees: ["No standard additional monthly fees shown in the official FAQ", "Deposit: $500", "Pet fee: $300 one or $400 two", "Pet rent: $10/month each"],
  },
  "crest-acworth": {
    auditStatus: "source_conflict",
    auditNote: "Live rents shifted by several dollars during the audit; the displayed range is a dated official-site observation.",
    oneBed: { min: 1440, max: 1604, note: "Official live available-unit range observed September 4, 2026; dynamic pricing may move." },
    twoBed: { min: 1837, max: 2705, note: "Official live range; upper end includes carriage-home layouts." },
    priceConfidence: "conflict",
    fees: ["Application: $100", "Administration: $150", "Deposit: $400, half-month, or one month depending on screening", "Valet trash: $31/month", "Locker: $3/month", "Pest: $5/month", "Key fob: $75 per leaseholder", "Pet fee: $300–$500 each", "Pet deposit: $200 each", "Pet screening: $30/year", "No monthly pet rent currently advertised"],
  },
  "avana-acworth": {
    auditStatus: "source_conflict",
    auditNote: "Official and community-supplied current price responses differed; shown totals are a dated snapshot.",
    priceConfidence: "conflict",
    fees: ["Mandatory fees included in shown total: $41/month", "Trash: $10/month", "Packages: $18/month", "Pest: $6/month", "Billing: $7/month", "Application: $35 per applicant", "Access device: $50", "Refundable deposit: $300", "Optional garage: $125/month", "Optional storage: $50/month"],
  },
  "park-kennesaw": {
    auditStatus: "limited_public_data",
    auditNote: "The official site asks for a quote; current totals, fees, and review data are from the linked community-supplied listing.",
    oneBed: { min: 1372, max: 1452, note: "Current community-supplied total monthly price." },
    twoBed: { min: 1675, max: 1809, note: "Current community-supplied total monthly price." },
    priceBasis: "Advertised total monthly price",
    priceSource: "Community-supplied current listing; official site requires a quote",
    priceConfidence: "snapshot",
    deal: null,
    dealDetail: "The current linked listing says no rent special. Ask the property about any newly added unit-specific offer.",
    dealExpires: null,
    security: ["On-site management", "24-hour emergency maintenance"],
    petCost: "Community-supplied terms: up to 2 pets; $300 fee + $10/month per pet; restrictions may apply.",
    fees: ["Application: $100 per applicant", "Administration: $150", "Pest: $1/month", "Doorstep trash: $25/month", "Pet fee: $300 each", "Pet rent: $10/month each", "Optional storage: $25/month", "Garage: price varies"],
  },
  "atlantic-canton-ridge": {
    auditStatus: "official",
    auditNote: "Current available-unit starts were rechecked on the official site; deal terms and fee details are community-supplied.",
    oneBed: { min: 1217, max: 1241, note: "Official currently available-unit starting rents." },
    twoBed: { min: 1335, max: 1485, note: "Official currently available-unit starting rents." },
    deal: "2 months free or $1,500 off",
    dealDetail: "Community-supplied offer: apply by September 7, 2026 for two months free on select units or $1,500 off all units; restrictions apply.",
    dealExpires: "2026-09-07",
    fees: ["Fixed recurring fees reported: $69.49/month plus variable utilities", "Valet trash: $15/month", "Property-loss benefit: $15/month", "Trash: $20/month", "Pest: $5/month", "Locker: $5/month", "Utility billing: $9.49/month", "Reservation: $150", "Application: $75 per applicant; a separate $75/unit listing conflicts—confirm", "Administration: $150", "Access device: $50", "Deposit: $500", "Utility setup: $25"],
  },
  "madison-overlook": {
    auditStatus: "official",
    auditNote: "Live rents, the official move-in offer, mandatory service bundle, pet terms, and review snapshot were rechecked.",
    deal: "Half off rent for first 5 months",
    dealDetail: "Move in by September 30, 2026 for half off rent during the first five months on select units. The linked listing adds new-applicant and tour/apply-within-48-hours terms; confirm eligibility.",
    dealExpires: "2026-09-30",
    fees: ["Mandatory resident-services bundle: $133/month", "Application: $65 per adult", "Administration: $250", "Deposit: $300, $600, or one month depending on screening", "Utility setup: $6.01", "Utility final fee: $6.01", "Optional garage: $175/month"],
  },
  "canton-mill-lofts": {
    auditStatus: "official",
    auditNote: "Rents, promotion, amenities, access features, and review were rechecked; fee and pet amounts are community-supplied.",
    petCost: "Community-supplied terms: up to 3 pets; $350 one-time fee + $25/month per pet; no pet deposit or weight limit; breed restrictions.",
    fees: ["Mandatory recurring bundle reported: $147.25/month", "Liability: $12/month", "Service bundle: $128.25/month", "Billing administration: $7/month", "Pet fee: $350 per pet", "Pet rent: $25/month per pet"],
    pricingUrl: "https://livecantonmill.com/apartments/",
  },
  "accent-overlook": {
    auditStatus: "official",
    auditNote: "Official floor plans and the current move-in promotion were rechecked. Pet dollar amounts remain third-party and should be confirmed.",
    oneBed: { min: 1325, max: 1590, note: "Current official floor-plan starting-rent range." },
    deal: "2 months free",
    dealDetail: "Official offer: two months free on select homes for move-in by October 31, 2026; contact leasing for eligibility and full terms.",
    dealExpires: "2026-10-31",
    security: ["Controlled/gated access"],
  },
  "district-etowah": {
    auditStatus: "official",
    auditNote: "Current ranges, fees, amenities, access features, pet terms, and review snapshot were rechecked.",
    fees: ["Application: $100", "Reservation: $150", "Deposit: $400 to one month", "Package lockers: $5/month", "Parking: $45/month per car", "Pest control: $5/month", "Trash: $13/month", "Swiftlane activation: $55 one-time per leaseholder"],
  },
  "harbor-creek": {
    auditStatus: "limited_public_data",
    auditNote: "The official dynamic page did not expose complete price ranges; shown starts and the review are community-supplied.",
    security: ["Gated entry", "24-hour emergency maintenance"],
    amenities: ["Indoor & outdoor pools", "24-hour fitness", "Pickleball & tennis", "Dog park & aqua park", "Playground", "Smart-home features"],
  },
  "walden-crossing": {
    auditStatus: "official",
    auditNote: "Current unit ranges and the official promotion were rechecked; public pet dollar charges remain unavailable.",
    oneBed: { min: 1325, max: 1725, note: "Current official available-unit range." },
    deal: "6 weeks free",
    dealDetail: "Official page: six weeks free on available 1-, 2-, and 3-bedroom homes; new applicants and restrictions apply. No public expiration was shown.",
    dealExpires: null,
  },
  "heritage-riverstone": {
    auditStatus: "official",
    auditNote: "Current management-network base-rent ranges, pet terms, amenities, access features, and review were rechecked.",
    oneBed: { min: 1178, max: 1815, note: "Current management-network base-rent plan range; availability and lease-term pricing are dynamic." },
    twoBed: { min: 1342, max: 1984, note: "Current management-network base-rent plan range; availability and lease-term pricing are dynamic." },
    fees: ["Application: $65", "Pet fee: $350 first + $350 second", "Pet rent: $25/month per pet", "Pet screening: $30/year"],
  },
  "grand-reserve-canton": {
    auditStatus: "official",
    auditNote: "JavaScript-rendered official inventory confirmed the displayed ranges, deal, and pet terms; some move-in charges vary.",
    deal: "$99 application/admin/deposit",
    dealDetail: "Official live offer: $99 total application fee, administration fee, and deposit with approved credit for move-in by September 20, 2026; restrictions apply.",
    security: ["After-hours courtesy patrol", "On-site management"],
    fees: ["Current promotion: $99 total application/admin/deposit with approved credit", "Outside the promotion, deposit varies; another management listing differs—confirm", "Required Xfinity media bundle: amount not publicly shown", "Pet: $400 one/$600 two", "Pet rent: $25/month each"],
  },
  "aspect-river": {
    auditStatus: "official",
    auditNote: "The official page confirmed two current 1BR prices and the promotion; all 2BR plans currently require a quote.",
    oneBed: { min: 1200, max: 1500, note: "Official current units: Fairlie at $1,200 and Castleberry at $1,500." },
    twoBed: { min: null, max: null, note: "2BR plans exist, but no current public price or availability is shown; call." },
    priceSource: "Official floor plans and current community-supplied unit cross-check",
    deal: "2 months free",
    dealDetail: "Official page displays two months free, prorated over four months. The popup still calls it an August special, so confirm before relying; no public end date was shown.",
    petCost: "Up to 2 pets, 300 lb maximum; $300 fee + $40/month per pet; $25 pet screening; breed restrictions.",
    fees: ["Application: $50 per applicant", "Administration: $175 per application", "Deposit: $500 approved; $1,000 conditional", "Valet trash: $25/month", "Pest: $3/month", "Amenity fee: $7.50/month", "Pet screening: $25", "Pet fee: $300", "Pet rent: $40/month per pet"],
    priceConfidence: "official",
  },
  "legends-laurel-canyon": {
    auditStatus: "official",
    auditNote: "Official live floor-plan ranges and promotion replaced stale values from an older portal snapshot.",
    oneBed: { min: 1495, max: 2025, note: "Official current advertised range across Juniper, Waleska, and alternate layouts." },
    twoBed: { min: 1825, max: 2367, note: "Official current advertised range across Riverstone and alternate layouts; one Reinhardt plan requires a quote." },
    deal: "4 weeks free",
    dealDetail: "Official offer: four weeks free on leases of 12 months or longer; no public expiration was shown.",
    pricingUrl: "https://www.legendsatlaurelcanyon.com/floor-plans",
    galleryUrl: "https://www.legendsatlaurelcanyon.com/gallery",
  },
  "crest-laurel-canyon": {
    auditStatus: "official",
    auditNote: "Official live unit and lease-term ranges were expanded across all 1BR and 2BR layouts; upper values reflect term-dependent pricing.",
    oneBed: { min: 1419, max: 3222, note: "Official live Cypress unit/lease-term range; the Birch plan requires a quote." },
    twoBed: { min: 1706, max: 3877, note: "Official live range across Maple, Oak, and Hawthorne units and lease terms." },
    priceBasis: "Official advertised base-rent range across units and lease terms",
    priceSource: "Official property floor plans",
    priceConfidence: "official",
    deal: "$800 off for qualifying employees",
    dealDetail: "Targeted offer: $800 off the first full month for employees of qualifying employers. Ask whether the employer participates; restrictions apply; no public expiry.",
  },
  "alexander-ridge": {
    auditStatus: "official",
    auditNote: "Market-rate rents were rechecked. Separate lower prices require household eligibility and are not mixed into the market-rate sort.",
    oneBed: { min: 1199, max: 1251, note: "Current market-rate range. Separate 60% AMI 1BR homes were $1,125–$1,246." },
    twoBed: { min: 1400, max: 1534, note: "Current market-rate range. Separate 50%/60% AMI 2BR homes were $1,211 and $1,334–$1,484." },
    petCost: "Up to 2 pets; $300 one/$500 two + $40/month each. Ask the property whether any breed rules apply.",
  },
  "lancaster-ridge": {
    auditStatus: "limited_public_data",
    auditNote: "Both eligible floor plans are marked coming soon or call; no currently available unit was verified.",
    twoBed: { min: 1450, max: null, note: "Advertised starting price; the plan is marked Coming Soon, so no currently available unit was verified." },
    galleryUrl: "https://www.lifeatlancaster.com/gallery",
  },
  "northwood-canton": {
    auditStatus: "limited_public_data",
    auditNote: "The former property domain currently shows a generic Clarkston template. Links now use the valid management-network listing; only claims supported there are retained.",
    officialUrl: "https://www.rentcafe.com/apartments/ga/canton/northwood3/default.aspx",
    pricingUrl: "https://www.rentcafe.com/apartments/ga/canton/northwood3/default.aspx",
    amenitiesUrl: "https://www.rentcafe.com/apartments/ga/canton/northwood3/default.aspx",
    galleryUrl: "https://www.rentcafe.com/apartments/ga/canton/northwood3/default.aspx",
    amenities: ["Shared laundry", "Washer/dryer hookups in select homes", "On-site management"],
    security: ["On-site management"],
    fees: ["Application: $25–$50", "No-pet policy", "Confirm all move-in and recurring charges"],
    imageSource: "Previously published property-site photo; verify against current management gallery",
    _delete: ["galleryImages"],
  },
  "ridgewalk-income": {
    auditStatus: "limited_public_data",
    auditNote: "The official manager publishes no rents. Community-supplied prices and fees are shown; the property includes both LIHTC and market-rate units.",
    eligibility: "Mixed community: 239 LIHTC and 101 market-rate units; confirm the eligibility rules for the specific home",
    priceSource: "Community-supplied Apartments.com listing",
    security: ["Controlled/gated access reported by the community-supplied listing", "On-site management"],
    fees: ["Application: $35", "Good-faith fee: $100", "Security deposit: $350 to one month", "Storage: $35/month", "Trash included", "Pet fee: $450 one/$600 two", "Pet rent: $25 one/$55 two"],
  },
  "avonlea-towne-lake": {
    auditStatus: "limited_public_data",
    auditNote: "The official page could not display inventory; current rents, promotion, and review are community-supplied.",
    twoBed: { min: 1823, max: 2060, note: "Current community-supplied available-unit base-rent range." },
    priceSource: "Community-supplied Apartments.com inventory; official page unavailable",
    priceConfidence: "snapshot",
    dealDetail: "Community-supplied offer: half off the first full month on eligible classic homes; confirm the unit and lease term.",
    security: ["Gated community", "Alarm system included", "On-site management"],
    galleryUrl: "https://www.avonleatownelake.com/apartments/ga/woodstock/photo-gallery",
  },
  "brooke-mill": {
    auditStatus: "source_conflict",
    auditNote: "Official unit/lease-term ranges and community-supplied base figures differed; the official range is displayed and the conflict is disclosed.",
    oneBed: { min: 1361, max: 3160, note: "Official advertised range across current units and lease terms; community-supplied base figures were lower." },
    twoBed: { min: 1394, max: 2113, note: "Official advertised range across current units and lease terms; community-supplied figures differed." },
    priceConfidence: "conflict",
    deal: "6 weeks free",
    dealDetail: "Official offer: lease by September 30, 2026 on a 13–15 month term for six weeks free; confirm eligibility.",
    dealExpires: "2026-09-30",
    fees: ["Application: $125", "Administration: $200", "Storage: $65/month", "Pet charges: call"],
    galleryUrl: "https://www.liveatbrookemill.com/photogallery",
  },
  "heights-towne-lake": {
    auditStatus: "limited_public_data",
    auditNote: "Current rents and fees are community-supplied because the official site does not expose a structured live-price feed.",
    oneBed: { min: 1458, max: 1581, note: "Community-supplied advertised/base-rent range; mandatory fees are additional." },
    twoBed: { min: 1684, max: 1870, note: "Community-supplied advertised/base-rent range; mandatory fees are additional." },
    fees: ["Application: $75 per person", "Administration: $150 per apartment", "Deposit: from $250", "Valet trash: $25/month", "Pest: $3/month", "Service fee: $5/month"],
  },
  "park-towne-lake": {
    auditStatus: "official",
    auditNote: "Advertised monthly totals, fee components, access features, pet terms, and review snapshot were rechecked.",
    pricingUrl: "https://livebh.com/apartments/park-at-towne-lake-apartments/floor-plans/",
    fees: ["Application: $75", "Administration: $150", "Doorstep trash: $25/month", "Pest: $4/month", "Utility service: $8/month", "Variable utilities additional", "Pet fee: $300 each", "Pet rent: $10/month each"],
  },
  "the-palmer": {
    auditStatus: "source_conflict",
    auditNote: "Greystar confirms total-price presentation, but its live widget was not reliably extractable; ranges are community-supplied and promotion sources differ.",
    oneBed: { min: 1374, max: 1536, note: "Community-supplied total monthly leasing-price range including mandatory fees." },
    twoBed: { min: 1363, max: 1665, note: "Community-supplied total monthly leasing-price range including mandatory fees." },
    priceBasis: "Total monthly leasing price including mandatory fees",
    priceSource: "Community-supplied totals; official Greystar widget was not reliably extractable",
    priceConfidence: "conflict",
    deal: "Up to 1 month free",
    dealDetail: "The official property advertises up to one month free on base rent for select homes; a community-supplied listing says up to six weeks. Confirm the written offer.",
    security: ["Controlled/gated access", "Package room"],
    petCost: "Official policy: maximum 2, no weight limit, aggressive-breed restrictions; charges are not publicly disclosed and a linked listing conflicts—confirm.",
    fees: ["Pest: $4.99/month", "Doorstep trash: $25/month", "Utility-billing administration: $5.35/month", "Washer/dryer rental: $50/month per rentable item", "Access device: $50", "Utility setup: $15", "Final utility bill: $10", "Variable utilities and liability charges additional"],
    review: { rating: null, count: 0, source: "Apartments.com—no renter rating" },
  },
  "park-9": {
    auditStatus: "limited_public_data",
    auditNote: "The official embedded inventory and fee guide were not reliably extractable; current totals and unverified charges are clearly labeled.",
    oneBed: { min: 1404, max: 1794, note: "Community-supplied total monthly price; official embedded inventory was not reliably extractable." },
    twoBed: { min: 1784, max: 2244, note: "Community-supplied total monthly price; official embedded inventory was not reliably extractable." },
    priceBasis: "Community-supplied advertised total monthly price",
    priceSource: "Community-supplied current listing; official embedded inventory blocked",
    priceConfidence: "snapshot",
    security: ["Parcel/package system", "On-site team"],
    petCost: "Previously reported: up to 2 pets, $250 each + $25/month each; not revalidated first-party—confirm.",
    fees: ["Previously reported mandatory fees: $98.56/month—confirm", "Internet: $60/month—confirm", "Pest: $4/month—confirm", "Water administration: $14.56/month—confirm", "Valet trash: $20/month—confirm"],
    review: { rating: null, count: 0, source: "Apartments.com—no renter rating" },
    _delete: ["detectedDeal"],
  },
  "station-92": {
    auditStatus: "source_conflict",
    auditNote: "Official and community-supplied 1BR values differed by $5 at the low end; the official range is displayed.",
    oneBed: { min: 1655, max: 1680, note: "Official current advertised range; linked inventory showed $1,650–$1,730." },
    twoBed: { min: 1925, max: 2095, note: "Official current advertised range." },
    priceConfidence: "conflict",
    dealDetail: "One month free through September 30, 2026 on select homes; new residents only and transfers excluded.",
    security: ["Smart-home technology", "On-site management"],
    fees: ["Application: $100 per person", "Administration: $200 per apartment", "Dog fee shown: $400", "Pet rent: $20/month", "Cat one-time fee: confirm"],
    _delete: ["detectedDeal", "dealStatus"],
  },
  "elevate-woodstock": {
    auditStatus: "limited_public_data",
    auditNote: "Official plan starts are shown; whether mandatory charges are included is not disclosed, and no renter-rating score is currently available.",
    oneBed: { min: 1443, max: null, note: "Official advertised start for the A2 plan; the A1 plan requires a quote." },
    twoBed: { min: 1836, max: null, note: "Official advertised start for the B2 plan; one home was shown and the B1 plan requires a quote." },
    priceBasis: "Official advertised rent; mandatory-fee inclusion is not disclosed",
    priceSource: "Official property floor plans",
    pricingUrl: "https://elevatewoodstockapts.com/floorplans/",
    amenitiesUrl: "https://elevatewoodstockapts.com/amenities/",
    priceConfidence: "official",
    security: ["Package service reported by the current listing", "On-site management reported by the current listing"],
    review: { rating: null, count: 0, source: "Apartments.com—no renter rating" },
  },
  "riverstock": {
    auditStatus: "limited_public_data",
    auditNote: "Five official 2BR homes were shown. The saved review link no longer resolves to a property review page, so no rating or count is claimed.",
    eligibility: "Income-restricted: minimum income $42,090; household maximums vary from $49,500 to $70,680 for 1–4 occupants; student-status rules apply; vouchers accepted",
    twoBed: { min: 1501, max: null, note: "Official 1,167-sf 2BR price; five units were shown (123, 212, 302, 714, and 722)." },
    security: ["Gated community", "Controlled/key-fob entry"],
    review: { rating: null, count: null, source: "No live review source", url: null },
  },
  "the-knox": {
    auditStatus: "official",
    auditNote: "Current official ranges, all-homes promotion, amenities, access features, pet terms, and review snapshot were rechecked.",
    oneBed: { min: 1448, max: 1588, note: "Current official advertised base-rent range." },
    twoBed: { min: 1776, max: 2100, note: "Current official advertised range; one layout still requires a quote." },
    dealDetail: "Official offer: six weeks free on all apartment homes for move-in by September 30, 2026; confirm lease terms.",
    fees: ["Application: $85 per person", "Administration: $200 per apartment", "Deposit varies", "Pet fee: $350 one/$500 two", "Pet rent: $20/month each"],
    pricingUrl: "https://theknoxbellsferry.com/floorplans/",
    priceSource: "Official property floor plans",
    priceConfidence: "official",
  },
  "cherokee-summit": {
    auditStatus: "official",
    auditNote: "Current advertised ranges, fees, pet terms, access features, amenities, and review snapshot were rechecked.",
    oneBed: { min: 1294, max: 1320, note: "Current advertised base-rent range; fees additional." },
    twoBed: { min: 1326, max: 1426, note: "Current advertised base-rent range; fees additional." },
    priceSource: "Official property floor plans and current community-supplied cross-check",
    pricingUrl: "https://www.cherokeesummitga.com/apartments/ga/acworth/floor-plans",
    priceConfidence: "official",
    security: ["Controlled access", "On-site management", "24-hour emergency maintenance"],
    fees: ["Application: $75 per person", "Administration: $200", "Amenity: $18/month", "Utility administration: $6/month", "Pest: $4/month", "Trash billed by unit/occupants", "Usage-based water/sewer/trash additional"],
  },
  "the-everlee": {
    auditStatus: "official",
    auditNote: "Current unit counts/ranges, promotion, fees, pet terms, access features, amenities, and review were rechecked.",
    security: ["Gated entry", "Package lockers", "Smart lock/doorbell"],
    fees: ["Application: $100 per person", "Administration: $200 per apartment", "Optional garage: $175/month", "Pet fee: $300 one/$500 two", "Pet rent: $20/month each"],
    _delete: ["detectedDeal", "dealStatus"],
  },
  "the-parker": {
    auditStatus: "source_conflict",
    auditNote: "Official pricing and fees were rechecked; the current promotion is community-supplied and is not displayed on the official page.",
    oneBed: { min: 1711, max: 2286, note: "Advertised total monthly price; base rent was $1,595–$2,170." },
    twoBed: { min: 1915, max: 2831, note: "Advertised total monthly price; base rent was $1,799–$2,715." },
    dealDetail: "Community-supplied offer: up to ten weeks free, possibly with waived application, administration, and deposit. The official page did not surface it; get terms in writing.",
    amenities: ["Pool", "Pickleball", "24-hour fitness", "Coworking", "Dog park & spa", "EV charging"],
    security: ["Keyless-entry smart locks"],
    fees: ["Mandatory fixed fees: $116/month", "Pest: $10/month", "Package: $10/month", "Doorstep trash: $25/month", "Utility administration: $6/month", "Internet: $65/month", "Application: $100 per person", "Administration: $250", "Utility setup: $17", "Access device: $50", "Refundable deposit: $500", "Variable electric, water, sewer, and trash hauling additional"],
    pricingUrl: "https://theparkerga.com/floorplans/",
    amenitiesUrl: "https://theparkerga.com/amenities/",
  },
  "brookstone-acworth": {
    auditStatus: "source_conflict",
    auditNote: "Official rent and mandatory-fee ranges were rechecked; public pet-charge disclosures conflict, so those amounts are not presented as exact.",
    oneBed: { min: 1623.59, max: 1987.59, note: "Mandatory monthly total; base rent was $1,499–$1,863, generally on 13-month terms." },
    twoBed: { min: 2023.59, max: 2432.59, note: "Mandatory monthly total; base rent was $1,899–$2,308." },
    priceBasis: "Advertised mandatory monthly total",
    petCost: "Up to 2 pets, 75 lb, with breed restrictions; public charges conflict between $350–$500 and $25–$30/month—call.",
    security: ["Automatic gate-controlled vehicle entry", "Access-controlled package room"],
    fees: ["Mandatory fixed fees: $124.59/month", "Internet: $85/month", "Trash: $10/month", "Liability: $16.59/month", "Pest: $5/month", "Utility billing: $8/month", "Application: $100 per person", "Administration: $200", "Gate card: $25", "Deposit: $250"],
    priceConfidence: "conflict",
  },
  "the-quincy": {
    auditStatus: "official",
    auditNote: "Current visible unit starts/ranges, move-in promotion, fees, pet terms, amenities, and review snapshot were rechecked.",
    oneBed: { min: 1341, max: 1488, note: "Current visible official base-rent range; higher term-dependent aggregate maxima are excluded." },
    twoBed: { min: 1723, max: 1903, note: "Current visible official base-rent range." },
    security: ["Mailroom with package lockers", "On-site management"],
    fees: ["Application: $85 per person", "Administration: $250", "Valet trash: $30/month", "Pest: $5/month", "Variable water/sewer/trash additional", "Liability coverage: $13/month only if renter insurance is not supplied", "Pet fee: $350 first + $200 second", "Pet rent: $35/month each"],
    galleryUrl: "https://www.livethequincy.com/photogallery",
  },
  "summerwell-bells-ferry": {
    auditStatus: "official",
    auditNote: "The one current 2BR home, total/base price, fee components, pet terms, amenities, and review snapshot were rechecked.",
    twoBed: { min: 2158, max: 2158, note: "Advertised total for one 960-sf Aurora home: $2,000 base plus fixed fees; shown available October 28." },
    security: ["Individual home entrances", "On-site management"],
    fees: ["Base rent: $2,000", "Smart-home services: $150/month", "Utility-billing administration: $7.75/month", "Utility setup: $17", "Final bill: $20", "Variable electric and liability additional", "Community listing: $35 application and $1,500 refundable deposit", "Optional liability coverage: $20.42/month"],
  },
  "gregory-lane": {
    auditStatus: "source_conflict",
    auditNote: "Official availability shows no units while the linked current listing shows three 2BR homes; call before touring.",
    twoBed: { min: 1410, max: 1410, note: "Estimated total: $1,340 base + $15 community + $55 water. Official availability showed 0 results while the linked listing showed three homes." },
    deal: null,
    dealDetail: "The current linked listing explicitly says there are no specials.",
    dealExpires: null,
    security: ["Professionally managed", "24-hour emergency maintenance"],
    fees: ["Application: $55 per person", "Administration: $160", "Deposit: $500", "Community: $15/month", "Water: $55/month", "Pet fee: $300 one/$450 two", "Pet rent: $20/month each"],
    _delete: ["detectedDeal", "dealLastSeenAt", "dealStatus"],
  },
};

function mergeRecord(apartment, patch) {
  const nested = ["oneBed", "twoBed", "review"];
  for (const key of nested) {
    if (patch[key]) apartment[key] = { ...apartment[key], ...patch[key] };
  }
  for (const [key, value] of Object.entries(patch)) {
    if (!nested.includes(key) && key !== "_delete") apartment[key] = value;
  }
  for (const key of patch._delete ?? []) delete apartment[key];
  apartment.auditedAt = auditDate;
  apartment.auditStatus = patch.auditStatus ?? "official";
  apartment.oneBed.observedAt = auditDate;
  apartment.twoBed.observedAt = auditDate;
  apartment.review.observedAt = auditDate;
  delete apartment.dealStatus;
  if (apartment.deal) apartment.dealLastSeenAt = auditDate;
  else delete apartment.dealLastSeenAt;
}

async function updateFile(path) {
  const data = JSON.parse(await readFile(path, "utf8"));
  for (const apartment of data.apartments) {
    mergeRecord(apartment, corrections[apartment.id] ?? {
      auditStatus: "official",
      auditNote: "Identity, address, linked sources, displayed pricing, property details, and review snapshot were manually rechecked.",
    });
  }
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`);
  return data;
}

const primary = await updateFile(primaryPath);
const expanded = await updateFile(expandedPath);
const all = [...primary.apartments, ...expanded.apartments];
const missingCorrections = Object.keys(corrections).filter((id) => !all.some((apartment) => apartment.id === id));
if (missingCorrections.length) throw new Error(`Unknown correction ids: ${missingCorrections.join(", ")}`);

primary.meta.manualAudit = {
  completedAt: auditDate,
  communitiesReviewed: all.length,
  scope: "Identity/address, public 1BR/2BR pricing and availability, price basis, deals, fees, pet terms, amenities/access features, review snapshots, source links, available image reachability/provenance notes, and route inputs.",
  limitation: "This is a dated source audit, not a permanent accuracy guarantee. Rents, availability, fees, promotions, and reviews can change after the observation time; conflicting or blocked sources are labeled.",
};
primary.meta.coverageDefinition = "Researched apartment communities with public 1BR or 2BR information whose refreshed OSRM/OpenStreetMap no-traffic route plus a 30% planning buffer is at most 40 minutes to Sixes Elementary. This is not live traffic and is not a guaranteed feed of every individual available unit.";
primary.meta.automation.method = "Daily best-effort checks of configured primary pricing/source pages plus one refreshed OSRM/OpenStreetMap route matrix. Generic price hints are review-only and never overwrite curated rents; undated deals stop displaying as current after seven days unless reconfirmed.";
primary.meta.curatedAt = auditDate;
await writeFile(primaryPath, `${JSON.stringify(primary, null, 2)}\n`);

console.log(`Applied the ${auditDate} manual audit to ${all.length} apartment records.`);
