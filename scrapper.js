const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs").promises;
const PDFDocument = require("pdfkit");
const { createWriteStream } = require("fs");
const sharp = require("sharp");

class AsuraScansChapterScraper {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.chapters = [];
  }

  async scrapeChapter(chapterNumber) {
    const url = `${this.baseUrl}/chapter/${chapterNumber}`;
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
          s,
        },
      });

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
    await fs.writeFile(
      "mist-might-mayhem.data.json",
      JSON.stringify(this.chapters, null, 2)
    );
    console.log("All chapter data saved to mist-might-mayhem.data.json");
  }

  async generatePDFs() {
    for (const chapter of this.chapters) {
      console.log(`Generating PDF for chapter ${chapter.chapterNumber}...`);
      const doc = new PDFDocument({ autoFirstPage: false });
      const output = createWriteStream(`chapter_${chapter.chapterNumber}.pdf`);
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

async function main() {
  const baseUrl =
    "https://asuracomic.net/series/omniscient-readers-viewpoint-5bb0db14";
  const scraper = new AsuraScansChapterScraper(baseUrl);

  const startChapter = 1;
  const endChapter = 10;

  await scraper.scrapeChapters(startChapter, endChapter);
  await scraper.saveData();

  await scraper.generatePDFs();
}

main().catch(console.error);
