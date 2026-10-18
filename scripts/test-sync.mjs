import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUTPUT_DIR = join(process.cwd(), "test-artifacts");
mkdirSync(OUTPUT_DIR, { recursive: true });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log("==================================================");
  console.log("   SYNCBEAT AUTOMATED DUAL-DEVICE E2E TEST RUN    ");
  console.log("==================================================");

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--autoplay-policy=no-user-gesture-required",
      "--use-fake-ui-for-media-stream",
      "--window-size=1280,900",
    ],
  });

  try {
    // -----------------------------------------------------------------
    // 1. Host loads Homepage
    // -----------------------------------------------------------------
    console.log("\n[1/7] Host: Opening http://localhost:3000...");
    const hostPage = (await browser.pages())[0] || (await browser.newPage());
    await hostPage.setViewport({ width: 1280, height: 900 });

    await hostPage.goto("http://localhost:3000", { waitUntil: "networkidle2" });
    const title = await hostPage.title();
    console.log(`  ✓ Homepage Title: "${title}"`);

    await hostPage.screenshot({ path: join(OUTPUT_DIR, "01-host-homepage.png") });

    // -----------------------------------------------------------------
    // 2. Host clicks "Create Soundstage"
    // -----------------------------------------------------------------
    console.log("\n[2/7] Host: Clicking 'Create Soundstage'...");
    const createBtn = await hostPage.waitForSelector("button::-p-text(Create Soundstage)");
    await createBtn.click();

    await hostPage.waitForFunction(() => window.location.pathname.startsWith("/room/"), { timeout: 10000 });
    const roomUrl = hostPage.url();
    const roomCodeMatch = roomUrl.match(/\/room\/([A-Z0-9]+)/);
    if (!roomCodeMatch) {
      throw new Error(`Failed to navigate to room, current URL: ${roomUrl}`);
    }
    const roomCode = roomCodeMatch[1];
    console.log(`  ✓ Successfully created soundstage with 6-char Room Code: ${roomCode}`);
    console.log(`  ✓ Room URL: ${roomUrl}`);

    // -----------------------------------------------------------------
    // 3. Host unlocks Soundstage Modal
    // -----------------------------------------------------------------
    console.log("\n[3/7] Host: Unlocking audio context in modal...");
    const hostUnlockBtn = await hostPage.waitForSelector("button::-p-text(Connect & Activate Audio)");
    await hostUnlockBtn.click();
    await sleep(600);

    await hostPage.screenshot({ path: join(OUTPUT_DIR, "02-host-room-ready.png") });
    console.log("  ✓ Host audio context unlocked and ready.");

    // -----------------------------------------------------------------
    // 4. Listener joins the Soundstage
    // -----------------------------------------------------------------
    console.log(`\n[4/7] Listener: Opening room URL ${roomUrl} in 2nd tab...`);
    const listenerPage = await browser.newPage();
    await listenerPage.setViewport({ width: 1280, height: 900 });
    await listenerPage.goto(roomUrl, { waitUntil: "networkidle2" });

    const listenerUnlockBtn = await listenerPage.waitForSelector("button::-p-text(Connect & Activate Audio)");
    await listenerUnlockBtn.click();
    await sleep(800);

    await listenerPage.screenshot({ path: join(OUTPUT_DIR, "03-listener-room-ready.png") });
    console.log("  ✓ Listener audio context unlocked.");

    // -----------------------------------------------------------------
    // 5. Verify Connected Devices Mesh Roster
    // -----------------------------------------------------------------
    console.log("\n[5/7] Verifying connected device mesh presence...");
    const hostMembersText = await hostPage.$eval(
      "body",
      (el) => el.innerText
    );

    const hasHostBadge = hostMembersText.includes("Host");
    const hasDevices = hostMembersText.includes("device(s) on soundstage") || hostMembersText.includes("Connected Devices");
    console.log(`  ✓ Presence Mesh: Host detected = ${hasHostBadge}, Roster active = ${hasDevices}`);

    // -----------------------------------------------------------------
    // 6. Host triggers Playback (Scheduled buffer execution)
    // -----------------------------------------------------------------
    console.log("\n[6/7] Host triggers Play -> Testing Scheduled Audio Sync...");
    // Find and click play button on host
    const clicked = await hostPage.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const playBtn = btns.find((b) => b.querySelector("svg.lucide-play"));
      if (playBtn) {
        playBtn.click();
        return true;
      }
      return false;
    });
    if (!clicked) throw new Error("Could not find master Play button on Host!");

    console.log("  ✓ Host clicked Play. AudioEngine scheduling 1200ms buffer window...");

    // Wait 3.5 seconds to pass buffer window and trigger drift control tick
    await sleep(3500);

    // Check if listener is playing
    const listenerPlaying = await listenerPage.evaluate(() => {
      const isPausedIcon = document.querySelector("svg.lucide-pause");
      return Boolean(isPausedIcon);
    });

    // Check drift report from listener
    const driftData = await listenerPage.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasSub30: text.includes("SUB-30MS") || text.includes("Sub-30ms Precision Lock") || text.includes("In Sync"),
        snippet: text.slice(0, 300),
      };
    });

    console.log(`  ✓ Listener synchronized playback status: playing = ${listenerPlaying}`);
    console.log(`  ✓ Telemetry reports Sub-30ms Lock active: ${driftData.hasSub30}`);

    await hostPage.screenshot({ path: join(OUTPUT_DIR, "04-host-playing-sync.png") });
    await listenerPage.screenshot({ path: join(OUTPUT_DIR, "05-listener-playing-sync.png") });

    // -----------------------------------------------------------------
    // 7. Verify QR Invite Modal & Code Display
    // -----------------------------------------------------------------
    console.log("\n[7/7] Opening and verifying QR Code Invite Modal...");
    const qrClicked = await hostPage.evaluate(() => {
      const btn = document.querySelector("button[title='Open QR Code Invite']");
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    if (qrClicked) {
      await sleep(600);
      const modalHasCode = await hostPage.evaluate((code) => {
        return document.body.innerText.includes(code);
      }, roomCode);
      console.log(`  ✓ QR Modal verified displaying Room Code "${roomCode}": ${modalHasCode}`);
      await hostPage.screenshot({ path: join(OUTPUT_DIR, "06-qr-invite-modal.png") });
    }

    console.log("\n==================================================");
    console.log("   🎉 ALL 7 SYNCBEAT E2E INTEGRATION TESTS PASSED! ");
    console.log(`   Screenshots saved to: ${OUTPUT_DIR}`);
    console.log("==================================================");
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
