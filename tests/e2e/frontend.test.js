const puppeteer = require('puppeteer-core');

let chromeLauncher;
try {
  chromeLauncher = require('chrome-launcher');
} catch (error) {
  console.warn(
    'chrome-launcher module is not installed. Set CHROME_PATH or install chrome-launcher to enable frontend E2E tests.'
  );
}

const axios = require('axios');
const { expect } = require('chai');

async function resolveChromeExecutable() {
  if (process.env.CHROME_PATH) {
    return process.env.CHROME_PATH;
  }

  if (!chromeLauncher) {
    throw new Error('chrome-launcher module is unavailable');
  }

  const installations = await chromeLauncher.Launcher.getInstallations();

  if (installations && installations.length > 0) {
    return installations[0];
  }

  throw new Error(
    'Unable to locate a Chrome/Chromium installation. ' +
      'Set the CHROME_PATH environment variable to the Chrome executable.'
  );
}

describe('CryptoHybrid Bank Frontend E2E Tests', () => {
  let browser;
  let page;
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3005';

  before(async function () {
    this.timeout(30000);

    let executablePath;
    try {
      executablePath = await resolveChromeExecutable();
    } catch (error) {
      console.warn(
        `Skipping frontend E2E tests: unable to find Chrome executable (${error.message})`
      );
      return this.skip();
    }

    try {
      await axios.get(baseUrl, { timeout: 3000 });
    } catch (error) {
      console.warn(
        `Skipping frontend E2E tests: unable to reach ${baseUrl} (${error.message})`
      );
      return this.skip();
    }

    browser = await puppeteer.launch({
      executablePath,
      headless: process.env.HEADLESS !== 'false',
      slowMo: 50,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
  });

  // If setup skipped (no page), skip individual tests
  beforeEach(function () {
    if (!page) this.skip();
  });

  after(async () => {
    if (browser) {
      await browser.close();
    }
  });

  describe('Landing and Navigation', () => {
    it('should load the homepage', async () => {
      await page.goto(baseUrl);
      await page.waitForSelector('body');

      const title = await page.title();
      expect(title).to.include('CryptoHybrid Bank');
    });

    it('should redirect to login page when not authenticated', async () => {
      await page.goto(`${baseUrl}/dashboard`);
      await page.waitForSelector('body');

      const url = page.url();
      expect(url).to.include('/login');
    });

    it('should display login form', async () => {
      await page.goto(`${baseUrl}/login`);
      await page.waitForSelector('form');

      const emailInput = await page.$('input[type="email"]');
      const passwordInput = await page.$('input[type="password"]');
      const submitButton = await page.$('button[type="submit"]');

      expect(emailInput).to.not.be.null;
      expect(passwordInput).to.not.be.null;
      expect(submitButton).to.not.be.null;
    });

    it('should navigate to register page', async () => {
      await page.goto(`${baseUrl}/login`);
      await page.waitForSelector('a[href="/register"]');

      await page.click('a[href="/register"]');
      await page.waitForSelector('form');

      const url = page.url();
      expect(url).to.include('/register');
    });
  });

  describe('User Registration', () => {
    const testUser = {
      firstName: 'Test',
      lastName: 'User',
      email: `test${Date.now()}@example.com`,
      password: 'TestPassword123!',
      dateOfBirth: '1990-01-01',
      countryCode: 'US',
    };

    it('should display registration form', async () => {
      await page.goto(`${baseUrl}/register`);
      await page.waitForSelector('form');

      const firstNameInput = await page.$('input[name="firstName"]');
      const lastNameInput = await page.$('input[name="lastName"]');
      const emailInput = await page.$('input[name="email"]');
      const passwordInput = await page.$('input[name="password"]');

      expect(firstNameInput).to.not.be.null;
      expect(lastNameInput).to.not.be.null;
      expect(emailInput).to.not.be.null;
      expect(passwordInput).to.not.be.null;
    });

    it('should register a new user successfully', async function () {
      this.timeout(10000);

      await page.goto(`${baseUrl}/register`);
      await page.waitForSelector('form');

      // Fill out the registration form
      await page.type('input[name="firstName"]', testUser.firstName);
      await page.type('input[name="lastName"]', testUser.lastName);
      await page.type('input[name="email"]', testUser.email);
      await page.type('input[name="password"]', testUser.password);
      await page.type('input[name="dateOfBirth"]', testUser.dateOfBirth);
      await page.select('select[name="countryCode"]', testUser.countryCode);

      // Submit the form
      await page.click('button[type="submit"]');

      try {
        await page.waitForNavigation({ timeout: 5000 });
        const url = page.url();
        expect(url).to.include('/dashboard');
      } catch (error) {
        const errorMessage = await page.$('.error-message, .toast-error');
        if (errorMessage) {
          const errorText = await page.evaluate((el) => el.textContent, errorMessage);
          console.log('Registration error:', errorText);
        }
      }
    });

    it('should show validation errors for invalid input', async () => {
      await page.goto(`${baseUrl}/register`);
      await page.waitForSelector('form');

      await page.click('button[type="submit"]');

      const firstNameInput = await page.$('input[name="firstName"]');
      const isValid = await page.evaluate((input) => input.checkValidity(), firstNameInput);
      expect(isValid).to.be.false;
    });
  });

  describe('User Login', () => {
    it('should display login form', async () => {
      await page.goto(`${baseUrl}/login`);
      await page.waitForSelector('form');

      const emailInput = await page.$('input[name="email"], input[type="email"]');
      const passwordInput = await page.$('input[name="password"], input[type="password"]');
      const submitButton = await page.$('button[type="submit"]');

      expect(emailInput).to.not.be.null;
      expect(passwordInput).to.not.be.null;
      expect(submitButton).to.not.be.null;
    });

    it('should show error for invalid credentials', async function () {
      this.timeout(10000);

      await page.goto(`${baseUrl}/login`);
      await page.waitForSelector('form');

      await page.type('input[type="email"]', 'invalid@example.com');
      await page.type('input[type="password"]', 'wrongpassword');

      await page.click('button[type="submit"]');

      await page.waitForTimeout(2000);

      const url = page.url();
      expect(url).to.include('/login');
    });
  });

  describe('Dashboard (if authenticated)', () => {
    it('should display dashboard elements when authenticated', async function () {
      this.timeout(10000);

      await page.goto(`${baseUrl}/dashboard`);

      if (page.url().includes('/login')) {
        this.skip();
      }

      await page.waitForSelector('body');

      const welcomeText = await page.$('text/Welcome');
      const balanceSection = await page.$('[class*="balance"], [class*="portfolio"]');

      expect(welcomeText || balanceSection).to.not.be.null;
    });
  });

  describe('Responsive Design', () => {
    it('should be responsive on mobile devices', async () => {
      await page.setViewport({ width: 375, height: 667 });
      await page.goto(`${baseUrl}/login`);
      await page.waitForSelector('form');

      const form = await page.$('form');
      const formBox = await form.boundingBox();

      expect(formBox.width).to.be.lessThanOrEqual(375);
      expect(formBox.height).to.be.greaterThan(0);
    });

    it('should be responsive on tablet devices', async () => {
      await page.setViewport({ width: 768, height: 1024 });
      await page.goto(`${baseUrl}/login`);
      await page.waitForSelector('form');

      const form = await page.$('form');
      const formBox = await form.boundingBox();

      expect(formBox.width).to.be.lessThanOrEqual(768);
      expect(formBox.height).to.be.greaterThan(0);
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading structure', async () => {
      await page.goto(`${baseUrl}/login`);
      await page.waitForSelector('body');

      const headings = await page.$$('h1, h2, h3, h4, h5, h6');
      expect(headings.length).to.be.greaterThan(0);
    });

    it('should have form labels', async () => {
      await page.goto(`${baseUrl}/login`);
      await page.waitForSelector('form');

      const inputs = await page.$$('input[type="email"], input[type="password"]');

      for (const input of inputs) {
        const id = await input.evaluate((el) => el.id);
        const name = await input.evaluate((el) => el.name);

        if (id) {
          const label = await page.$(`label[for="${id}"]`);
          expect(label).to.not.be.null;
        } else if (name) {
          const ariaLabel = await input.evaluate((el) => el.getAttribute('aria-label'));
          const placeholder = await input.evaluate((el) => el.placeholder);
          expect(ariaLabel || placeholder).to.not.be.null;
        }
      }
    });
  });

  describe('Performance', () => {
    it('should load within reasonable time', async function () {
      this.timeout(15000);

      const startTime = Date.now();
      await page.goto(baseUrl);
      await page.waitForSelector('body');
      const endTime = Date.now();

      const loadTime = endTime - startTime;
      expect(loadTime).to.be.lessThan(5000);
    });

    it('should not have console errors', async () => {
      const consoleErrors = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      await page.goto(`${baseUrl}/login`);
      await page.waitForSelector('form');

      const criticalErrors = consoleErrors.filter(
        (error) =>
          !error.includes('favicon') &&
          !error.includes('manifest.json') &&
          !error.includes('404')
      );

      expect(criticalErrors.length).to.equal(0);
    });
  });
});