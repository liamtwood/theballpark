const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const IMAGES = [
  // AV & Technology
  ['43" LCD Display', 'https://www.nextgenav.com.au/wp-content/uploads/2024/08/43-inch-LCD-Monitor-on-Floor-Stand.jpg'],
  ['55" 4K LED Screen', 'https://cdn.autonomous.ai/production/ecm/231026/Exploring-10-Best-Monitor-Floor-Stands-Elevate-Your-Display9.webp'],
  ['Awards Ceremony AV Package', 'https://humphriesav.co.uk/wp-content/uploads/2023/03/awards-ceremony-stage-set-lighting-projection-screens-1024x768.jpg'],
  ['Breakout Room AV Pack', 'https://pronto-core-cdn.prontomarketing.com/2/wp-content/uploads/sites/2831/2024/09/A-modern-breakout-room.webp'],
  ['Conference AV Package', 'https://avunit.com/images/conference-big-projection.jpg'],
  ['Confidence Monitor', 'https://craft.productions/wp-content/uploads/2021/11/Confidence-Monitor-2.jpg'],
  ['DJ Booth & Festival Sound', 'https://enthusiasmevents.co.uk/wp-content/uploads/2022/03/Mirror-Ball-DJ-booth-4-.jpg'],
  ['Follow Spot Package', 'https://www.inhouseav.com.au/wp-content/uploads/2016/03/Follow-Spot.png'],
  ['Hybrid Event Streaming Kit', 'https://streamgeeks.us/wp-content/uploads/2024/11/In-Person-vMix-Production-for-Hybrid-Event.jpg'],
  ['Interactive Touch Screen', 'https://veloxity.us/wp-content/uploads/veloxity-interactive-touch-screens-for-events-1.webp'],
  ['iPad Kiosk', 'https://oneworldrental.com/assets/front/images/products/product_220/IPad_Floor_Stand.webp'],
  ['LED Video Wall', 'https://www.soundandlightguys.co.uk/wp-content/uploads/2024/01/LED_Video_Wall_Conference-scaled.jpg'],
  ['Outdoor Event PA', 'https://cinemattag.com/wp-content/uploads/2023/01/JBL_Control_Outdoor_PA_System_Speakers_Hire_1-1279714278-e1673010851387.jpeg'],
  ['Outdoor LED Lighting Tower', 'https://www.nixonhire.co.uk/static/cms/catalogue/images/st-9-solar-mobile-lighting-tower-2.jpg'],
  ['Portable PA', 'https://www.hire-intelligence.co.uk/wp-content/uploads/2021/09/YamahaStagepas1Kb.jpg'],
  ['Premium LED Screen Wall', 'https://equinoxroadshow.com/wp/wp-content/uploads/2022/10/Plaisters-Hall-Equinox-Roadshow-LED-Wall-scaled.jpeg'],
  ['Red Carpet Uplighting', 'https://redcarpetsystems.com/wp-content/uploads/2023/11/UplightingRental.jpg'],
  ['Room Wash & Ambience', 'https://go2eventhire.com/cdn/shop/files/Venue_Up-lights_2048x.jpg'],
  ['Wireless Microphone Package', 'https://www.nextgenav.com.au/wp-content/uploads/2024/04/Wireless-Lapel-Microphone-Hire-Melbourne.jpg'],
  // Catering
  ['Barista Coffee Service', 'https://www.coffee-bike.com/fileadmin/_processed_/6/b/csm_coffee-bike-mieten_landingpages_Kunden_step01_alldevices_da3007152a.jpg'],
  ['Breakfast & Coffee', 'https://allinhandcatering.co.uk/wp-content/uploads/2014/09/breakfast-for-office-meeting1.jpg'],
  ['Bowl Food Dinner', 'https://www.thecorporategourmet.co.uk/wp-content/uploads/2019/02/canapes8.jpg'],
  ['Branded Water Bottles', 'https://bottledevents.com/wp-content/uploads/bottle-lineup-230522.png'],
  ['Canape & Drinks Reception', 'https://www.thecorporategourmet.co.uk/wp-content/uploads/2019/02/canapes-1024x683.jpg'],
  ['Canape Package', 'https://socialpantry.co.uk/wp-content/uploads/2024/12/Festive-Canapes-2.png'],
  ['Dessert Table', 'https://images.squarespace-cdn.com/content/v1/5c80bea390f9045d9cf66bdf/1673598466367-EL9FQ69Y3JV2BPO8DGSD/Dessert+Bar.JPG'],
  ['Grazing Table', 'https://www.carolynsabsolutelyfabulousevents.com/wp-content/uploads/2019/10/IMG_7437-e1571751534156.jpeg'],
  ['Late Night Snack', 'https://images.squarespace-cdn.com/content/v1/55993faee4b0d2540b6dd107/1511574444589-99MP8L6LD8KDLVUA0951/TI+Sliders.jpg'],
  ['Mobile Cocktail Bar', 'https://crushcocktailbars.com/wp-content/uploads/2025/05/IMG_0627.jpg'],
  ['Sit-Down Dinner', 'https://www.juliacharleseventmanagement.co.uk/wp-content/uploads/2025/04/Black-Linen-Tables-At-Gala-Dinner.jpg'],
  ['Street Food Station', 'https://streetfood-festivals.ch/wp-content/uploads/2018/02/DSC1735_3.jpg'],
  ['Tea & Coffee Station', 'https://oakparcevents.com/wp-content/uploads/2018/10/Coffee-Station-copy-1024x684.jpg'],
  ['Working Lunch Platters', 'https://www.yourztoeat.co.uk/wp-content/uploads/2023/04/working-lunch-3-scaled.jpg'],
  ['Working Lunch', 'https://www.lavendercatering.co.uk/wp-content/uploads/2021/05/Buffet-Lunch-712x337.jpg'],
  // Construction
  ['Basic Joinery', 'https://craftworksjoinery.co.uk/wp-content/uploads/2024/04/home-exhibition-stands-1.jpg'],
  ['Custom Carpentry', 'https://eliteprojex.com.au/wp-content/uploads/2025/08/exhibition-stand-carpentry-E-image-1.png'],
  ['De-rig & Disposal', 'https://www.contrabandevents.com/wp-content/uploads/2017/10/contraband-crew-exhibition-stand.png'],
  ['On-Site Installation Labour', 'https://exhibitsusa.com/wp-content/uploads/2017/12/exhibit-labor-services.jpg'],
  ['Premium Spray-Finish', 'https://www.expodisplayservice.com/wp-content/uploads/2024/08/Paints-Coatings.webp'],
  // Entertainment
  ['DJ & Sound System', 'https://uploads-ssl.webflow.com/5e312a97b76b83289d2deeef/6245726333840061cccfc70b_DJ-Equipment-Hire-Weddings-Functions-Events-The-DJ-Company.jpg'],
  ['Magician', 'https://magicalmemories.co.uk/wp-content/uploads/2019/01/Magicains-for-hire-1024x676.jpg'],
  ['Photo Booth', 'https://www.pictureblast.co.uk/wp-content/themes/pictureblast/images/gallery/gallery15.jpg'],
  ['Product Demo Presenter', 'https://mpg-events.com/wp-content/uploads/2014/03/CIMG0416-1024x768.jpg'],
  ['VR Experience', 'https://www.virtualrealityhire.com/wp-content/uploads/2020/02/VR-Hub.jpg'],
  // Flooring
  ['Branded Floor Graphic', 'https://maxgraphics.co/wp-content/uploads/2024/05/Event-Wedding-Floor-Graphics-and-Decals.jpeg'],
  ['Luxury Vinyl Plank', 'https://fthmb.tqn.com/ket6EiTx-6hS79RA1Wqke5bBCgI=/1800x990/filters:fill(auto,1)/ShawFloorteLuxuryVinylPlankFlooring-5acbfe30036fbebbd.jpg'],
  ['Raised Platform Floor', 'https://t3eventrentals.com/wp-content/uploads/2024/02/Staging-7-1024x768.jpg'],
  ['Resin Pour Floor', 'https://metallicepoxyclass.com/wp-content/uploads/2025/04/IMG_5743-Compressify.io_1_1-1536x1152.webp'],
  ['Standard Carpet Tiles', 'https://www.sommer-eventflooring.com/wp-content/uploads/2026/02/AdobeStock_222398238-1568x1045.jpeg'],
  // Florals
  ['Bar Top Florals', 'https://eventdecorhire.com/wp-content/uploads/2023/06/Bar-1200x848.jpg'],
  ['Botanical Room Fragrance', 'https://thebotanicaldistillery.com/wp-content/uploads/2021/04/fragrance-bottles-rose-jagged-frame.png'],
  ['Dried Flower Hanging', 'https://www.floretflowers.com/wp-content/uploads/2018/12/FloretBlog-4V3A0260.jpg'],
  ['Floral Ceiling Cloud', 'https://sarahwinward.com/wp-content/uploads/4the-cloud-floral-ceiling-installation-1400x1025.jpg'],
  ['Long Table Florals', 'https://studioblush.com/wp-content/uploads/2013/12/Lauren-Adam-1-Julia-Jane-Faves-hi-res-0033.jpg'],
  ['Mini Bud Vase', 'https://goodseedfloral.co/wp-content/uploads/2021/03/centerpieces-flower-Wedding-pricing-2.jpg'],
  ['Pampas & Neon', 'https://gloam.co.uk/wp-content/uploads/2020/07/Wedding_Boho_Modern_Pampas_Acrylic_Sign-1280x853.jpg'],
  ['Photo Moment Foliage Wall', 'https://abeventhire.co.uk/wp-content/uploads/2021/03/wall-5.jpg'],
  ['Stage / Altar Floral', 'https://purelycelebrations.com/wp-content/uploads/2025/05/luxury-cathedral-altar-flowers.webp'],
  ['Statement Entrance Floral Arch', 'https://forestgreen.ie/wp-content/uploads/2021/08/FloralWeddingArch.jpg'],
  ['Suspended Floral Chandelier', 'https://tarafay.ie/wp-content/uploads/2020/11/030-dublin-micro-wedding-sb-floral-greenery-garlands-crystal-chandelier.jpg'],
  ['Welcome Floral Pedestal', 'https://pinkcaviar.com.au/wp-content/uploads/2020/11/pedestal-with-flower-arrangement-white-pedastal-with-flowers-pink-caviar-events.jpg'],
  ['Wild Garden Table Centrepieces', 'https://gaynespark.co.uk/wp-content/uploads/2019/07/wild-wedding-flower-table-centrepiece-gaynes-park.jpg'],
  // Furniture
  ['Custom Reception Counter', 'https://www.eventfurniturehire.com/wp-content/uploads/2022/05/1936A3BC-239D-424E-AA85-03ED6A226A5C.jpg'],
  ['Display Plinth', 'https://www.accessdisplays.co.uk/wp-content/uploads/2017/07/display-plinth-hire-grimshaw-495x375.jpg'],
  ['Folding Chair', 'https://eventhireuk.com/wp-content/uploads/2023/12/11074-rent-deluxe-folding-chairs.jpg'],
  ['High Poseur Table', 'https://spaceworks.co.uk/wp-content/uploads/2023/01/square-high-bar-table-white.jpg'],
  ['Lounge Sofa', 'https://areeka.ae/wp-content/uploads/Areeka-Event-Rentals-Private-Party-10-1067x800.jpg'],
  // Graphics
  ['3D Fabricated Lettering', 'https://www.frontsigns.com/wp-content/uploads/2019/07/large-marquee-letters-500x280.jpg'],
  ['Fabric Tension Display', 'https://idec-displays.com/wp-content/uploads/2016/12/ReWalk-backlit-display-ACRM-2016-05-06.jpg'],
  ['Hanging Banner', 'https://everythingtradeshows.com/wp-content/uploads/2022/11/Hanging-Signs-180.jpg'],
  ['Large-Format Wall Graphic', 'https://eventprint.com.sg/wp-content/uploads/2019/02/wall-graphic-4.jpg'],
  ['Roller Banner', 'https://d1x3eomzsc6lfz.cloudfront.net/tradeprin/images/products_gallery_images/Exhibition-Displays-Premium-and-Budget-Pull-Up-Stands-x2.png'],
  // Health & Safety
  ['Accessibility Compliance Audit', 'https://pynxpro.ca/wp-content/uploads/2024/07/Wheelchair-Ramps-Wheelchair-Accessible-Stages-Pynx-Pro-1024x512.jpg'],
  ['Fire Marshal', 'https://theeventu.com/individuals/wp-content/uploads/2014/06/working-with-fire-marshal.jpg'],
  ['First Aid', 'https://eidushealth.com/wp-content/uploads/2022/05/Event-Medical-First-Aid-Company-960x479.jpg'],
  ['Risk Assessment & Method Statement', 'https://www.fldata.com/wp-content/uploads/2023/09/risk-assessment-method-statement-hero.png'],
  ['Structural Calculations', 'https://skyciv.com/wp-content/uploads/2022/07/event-rigging-software-skyciv-structural-analysis-software-3d-render-deflection-min-800x461.png'],
  // Lighting
  ['Backlit Fabric Lightbox', 'https://www.uk-exhibitionstands.co.uk/wp-content/uploads/2024/01/wlt-kg-k04-wavelight-display-wall-kit-01.webp'],
  ['Feature Pendant Light', 'https://www.modernpartyhireadelaide.com.au/assets/gallery-images/_feature/Pendant-Light-Black-Small.jpg'],
  ['Intelligent Lighting Rig', 'https://klassicsound.com/wp-content/uploads/2021/03/Event-Truss-grid.jpeg'],
  ['LED Spotlight', 'https://blog.yowcha.co.uk/templates/yootheme/cache/ed/led-par-cans-1-kireth-ai-ed5fa86c.jpeg'],
  ['LED Strip', 'https://uprisemed.com/wp-content/uploads/2022/02/London-apartment-lit-in-red-using-RGB-epistar-15w-per-meter-LED-tape-lights-2-scaled.jpg'],
  // Logistics
  ['Exhibition Freight', 'https://www.forestfreight.co.uk/wp-content/uploads/2019/12/events-header.jpg'],
  ['International Freight', 'https://airsealogistics.com.sg/wp-content/uploads/2023/11/The-Complete-Guide-to-Freight-Forwarding-770x460.jpg'],
  ['On-Site Forklift', 'https://www.marsforklifts.com.au/wp-content/uploads/2024/02/event-hire-photo-edit-jpg.webp'],
  ['Secure Storage', 'https://www.pfwhitehead.com/wp-content/uploads/2024/12/Secure-Storage-scaled.jpg'],
  ['UK Freight', 'https://www.ab247.co.uk/wp-content/uploads/2018/06/Event-Transportation-Van-AB247-H02-1024x576.jpg'],
  // Staffing
  ['Brand Ambassador', 'https://www.exhibition-girls.com/wp-content/uploads/2016/08/Exhibition-Girls-Promotion-Brand-Ambassadors-1024x683.jpg'],
  ['Multilingual Translator', 'https://ulanguage.com/wp-content/uploads/2020/07/intp34.jpg'],
  ['Receptionist / Host', 'https://registrationdesk.ie/wp-content/uploads/2020/02/IMG_4344-1-scaled.jpg'],
  ['Security Officer', 'https://bigguysagency.com/wp-content/uploads/2025/02/Event-Security-Guards.webp'],
  ['Technical Stand Crew', 'https://www.certainexhibitions.co.uk/exhibition-stands-img/JOB2668W0361-min.jpg'],
];

(async () => {
  const c = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  // Load all item names for fuzzy matching
  const allItems = await c.query('SELECT id, name FROM public.items WHERE is_active = true');
  const itemMap = {};
  for (const row of allItems.rows) itemMap[row.name] = row.id;

  let updated = 0, missed = 0;
  for (const [searchName, url] of IMAGES) {
    // Try exact match first
    let matchName = Object.keys(itemMap).find(n => n === searchName);
    // Try starts-with
    if (!matchName) matchName = Object.keys(itemMap).find(n => n.startsWith(searchName));
    // Try contains
    if (!matchName) matchName = Object.keys(itemMap).find(n => n.toLowerCase().includes(searchName.toLowerCase()));

    if (matchName) {
      await c.query('UPDATE public.items SET image_url = $1 WHERE id = $2', [url, itemMap[matchName]]);
      updated++;
    } else {
      console.log(`  ⚠ No match: "${searchName}"`);
      missed++;
    }
  }

  const check = await c.query('SELECT COUNT(*) FROM public.items WHERE image_url IS NOT NULL AND is_active = true');
  console.log(`\n✅ ${updated} updated, ${missed} missed`);
  console.log(`   Total items with image_url: ${check.rows[0].count}`);
  await c.end();
})();
