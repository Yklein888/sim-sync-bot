const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

(async () => {
  console.log("Starting Sync...");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    await page.goto('https://cellstation.co.il/portal/login.php');
    await page.fill('input[name="user"]', process.env.SITE_USERNAME);
    await page.fill('input[name="pass"]', process.env.SITE_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000); // המתנה לטעינה

    const cardsData = await page.$$eval('div.card', (elements) => {
      return elements.map(card => {
        const short = card.querySelector('p.pstyle')?.innerText || '';
        const plan = card.querySelector('p.plan')?.innerText || '';
        const text = card.innerText;
        const numbers = text.match(/\d{9,20}/g) || [];
        const dateMatch = text.match(/\d{4}-\d{2}-\d{2}/);
        const color = window.getComputedStyle(card).backgroundColor;
        const isActive = color.includes('0, 128, 0') || color === 'green';

        return {
          short_number: short,
          local_number: numbers[0] || '',
          israeli_number: numbers[1] || '',
          sim_number: numbers[2] || '', // ICCID
          package_name: plan,
          expiry_date: dateMatch ? dateMatch[0] : null,
          is_active: isActive
        };
      });
    });

    console.log(`Found ${cardsData.length} SIM cards. Updating Supabase...`);
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    await supabase.from('sim_cards').upsert(cardsData, { onConflict: 'sim_number' });
    console.log("Success!");
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await browser.close();
  }
})();
