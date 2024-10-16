const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs").promises;
const PDFDocument = require("pdfkit");
const { createWriteStream } = require("fs");
const sharp = require("sharp");
const path = require("path");

class BaseScraper {
  constructor(baseUrl, title) {
    this.baseUrl = baseUrl;
    this.title = title;
    this.chapters = [];
    this.outputFolder = path.join("output", this.title);
  }

  async fetchWithRetry(url, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await axios.get(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate, br",
            Connection: "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Cache-Control": "max-age=0",
          },
        });
        return response;
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }

  async scrapeChapter(chapterNumber) {
    throw new Error("Method 'scrapeChapter' must be implemented.");
  }

  async scrapeChapters(startChapter, endChapter) {
    for (let i = startChapter; i <= endChapter; i++) {
      console.log(`Scraping chapter ${i}...`);
      const chapterData = await this.scrapeChapter(i);
      if (chapterData) {
        this.chapters.push(chapterData);
        console.log(`Successfully scraped chapter ${i}`);
      } else {
        console.log(`Failed to scrape chapter ${i}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  async saveData() {
    await fs.mkdir(this.outputFolder, { recursive: true });
    await fs.writeFile(
      path.join(this.outputFolder, `${this.title}.json`),
      JSON.stringify(this.chapters, null, 2)
    );
    console.log(`All chapter data saved to ${this.title}.json`);
  }

  async generatePDFs() {
    for (const chapter of this.chapters) {
      console.log(`Generating PDF for chapter ${chapter.chapterNumber}...`);
      const doc = new PDFDocument({ autoFirstPage: false });
      const output = createWriteStream(
        path.join(this.outputFolder, `chapter_${chapter.chapterNumber}.pdf`)
      );
      doc.pipe(output);

      for (const image of chapter.images) {
        try {
          console.log(`Processing image: ${image.url}`);
          const response = await axios.get(image.url, {
            responseType: "arraybuffer",
          });
          console.log(`Content-Type: ${response.headers["content-type"]}`);

          let imgBuffer = Buffer.from(response.data);
          let imgSize;

          try {
            imgSize = doc.openImage(imgBuffer);
          } catch (directError) {
            console.log(
              `Direct add failed, trying conversion: ${directError.message}`
            );

            imgBuffer = await sharp(imgBuffer).png().toBuffer();
            imgSize = doc.openImage(imgBuffer);
          }

          doc.addPage({ size: [imgSize.width, imgSize.height] });
          doc.image(imgBuffer, 0, 0);
        } catch (error) {
          console.error(`Failed to add image to PDF: ${error.message}`);
        }
      }

      doc.end();
      console.log(`PDF generated for chapter ${chapter.chapterNumber}`);
    }
  }
}

class DrakeScansChapterScraper extends BaseScraper {
  async scrapeChapter(chapterNumber) {
    const url = `${this.baseUrl}-chapter-${chapterNumber}/`;
    try {
      console.log(`Fetching URL: ${url}`);
      const response = await this.fetchWithRetry(url);

      console.log(`Response status: ${response.status}`);

      const $ = cheerio.load(response.data);
      const title = $("title").text().trim();
      console.log("Title:", title);

      console.log("Searching for images...");
      const images = [];

      const noscriptContent = $("#readerarea noscript").html();
      if (noscriptContent) {
        const $noscript = cheerio.load(noscriptContent);

        $noscript("img").each((index, element) => {
          const src = $noscript(element).attr("src");
          if (src) {
            images.push({
              url: src.trim(),
              page: index + 1,
            });
          }
        });
      }

      console.log(`Found ${images.length} images for chapter ${chapterNumber}`);

      if (images.length === 0) {
        console.log("No images found. Dumping HTML:");
        console.log($.html());
      }

      return { chapterNumber, title, images };
    } catch (error) {
      console.error(`Failed to retrieve chapter ${chapterNumber}: ${url}`);
      console.error("Error details:", error.message);
      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response headers:", error.response.headers);
      }
      return null;
    }
  }
}

class AsuraScansChapterScraper extends BaseScraper {
  async scrapeChapter(chapterNumber) {
    const url = `${this.baseUrl}/chapter/${chapterNumber}`;
    try {
      const response = await this.fetchWithRetry(url);
      const $ = cheerio.load(response.data);

      const title = $("title").text().trim();
      const images = [];
      $("div.py-8 img").each((index, element) => {
        const src = $(element).attr("src");
        const alt = $(element).attr("alt");
        if (src && alt && alt.startsWith("chapter page")) {
          images.push({
            url: src,
            page: index + 1,
          });
        }
      });

      return { chapterNumber, title, images };
    } catch (error) {
      console.error(`Failed to retrieve chapter ${chapterNumber}: ${url}`);
      console.error("Error details:", error.message);
      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response headers:", error.response.headers);
      }
      return null;
    }
  }
}

async function main() {
  const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (query) =>
    new Promise((resolve) => readline.question(query, resolve));

  try {
    console.log("Choose a scraper:");
    console.log("1. DrakeScans");
    console.log("2. AsuraScans");
    const choice = await question("Enter your choice (1 or 2): ");

    const baseUrl = await question("Enter the base URL: ");
    const title = await question("Enter the title for this manga: ");
    const startChapter = parseInt(await question("Enter the start chapter: "));
    const endChapter = parseInt(await question("Enter the end chapter: "));

    let scraper;
    if (choice === "1") {
      scraper = new DrakeScansChapterScraper(baseUrl, title);
    } else if (choice === "2") {
      scraper = new AsuraScansChapterScraper(baseUrl, title);
    } else {
      console.log("Invalid choice. Exiting.");
      return;
    }

    await scraper.scrapeChapters(startChapter, endChapter);
    await scraper.saveData();
    await scraper.generatePDFs();
  } catch (error) {
    console.error("An error occurred in the main execution:");
    console.error(error);
  } finally {
    readline.close();
  }
}

main().catch(console.error);
module.exports = { DrakeScansChapterScraper, AsuraScansChapterScraper };
