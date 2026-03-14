import { chromium } from 'playwright';
import express from 'express';
import fs from 'fs';
import tmp from 'tmp';
import cors from 'cors';

const app = express();

const supportedFormats = {
  png: { contentType: 'image/png', args: { type: 'png' } },
  jpg: { contentType: 'image/jpeg', args: { type: 'jpeg' } },
  jpeg: { contentType: 'image/jpeg', args: { type: 'jpeg' } },
  webp: { contentType: 'image/webp', args: { type: 'webp' } },
  pdf: { contentType: 'application/pdf' },
};

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// 请求验证
app.use((req, res, next) => {
  if (req.method !== 'POST') {
    next({ status: 405, message: "Method not allowed" });
  } else if (req.get('Content-Type') !== 'application/json') {
    next({ status: 415, message: "Unexpected Content-Type" });
  } else if (typeof req.body.source !== 'string') {
    next({ status: 400, message: "Missing 'source'" });
  } else if (typeof req.body.format !== 'string' || !supportedFormats[req.body.format]) {
    next({ status: 400, message: "Invalid format" });
  } else {
    next();
  }
});

// API
app.post('/', async (req, res) => {
  const options = req.body.options || {};
  const format = supportedFormats[req.body.format];

  res.header("Content-Type", format.contentType);

  const tmpoutput = tmp.fileSync({ prefix: 'htmltoimage-' });
  const isPdf = req.body.format === 'pdf';

  options.args = Object.assign({}, options.args, format.args, { path: tmpoutput.name });

  try {
    const url = isUrl(req.body.source) ? req.body.source : await createTempHtml(req.body.source);

    await screenshot(url, isPdf, options);

    fs.createReadStream(tmpoutput.name)
      .pipe(res)
      .on('close', () => tmpoutput.removeCallback());

  } catch (e) {
    res.status(500).send({ error: e.message });
  }
});

const createTempHtml = async (html) => {
  const tmpinput = tmp.fileSync({ postfix: '.html' });
  fs.writeFileSync(tmpinput.name, html);
  return 'file://' + tmpinput.name;
};

const isUrl = (string) => {
  try {
    const url = new URL(string);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

// 🚀 Playwright 浏览器单例
let browser: any;
const getBrowser = async () => {
  if (!browser) {
    console.log("Launching Playwright browser...");
    browser = await chromium.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu'
      ]
    });
    console.log("Browser ready");
  }
  return browser;
};

const screenshot = async (url, isPdf, options) => {
  const browser = await getBrowser();
  const page = await browser.newPage();

  // viewport 设置
  await page.setViewportSize({
    width: options.width || 1200,
    height: options.height || 800
  });

  if (isUrl(url)) {
    await page.goto(url, { waitUntil: "networkidle" });
  } else {
    await page.goto(url, { waitUntil: "networkidle" });
  }

  if (isPdf) {
    await page.pdf({ format: 'A4', ...options.args });
  } else {
    await page.screenshot(options.args);
  }

  await page.close();
};

/**
 * Cloud Run / Functions 入口
 */
export const helloHttp = (req, res) => {
  app(req, res);
};
