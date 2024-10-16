# WEBTOONS Chapter Scraper

## Description

This script is designed to scrape manga chapters from AsuraScans and DrakeScans, a popular manga reading website. It allows users to download chapters as both JSON data and PDF files.

## Features

- Scrapes manga chapters from AsuraScans or DrakeScans
- Saves chapter data in JSON format
- Generates PDF files for each chapter
- Handles image processing and conversion
- Implements rate limiting to avoid overloading the server

## Prerequisites

Before running this script, make sure you have Node.js installed on your system. You'll also need to install the following npm packages:

```
npm install axios cheerio pdfkit sharp
```

## Usage

1. Clone this repository or download the script.
2. Install the required dependencies:
   ```
   npm install
   ```
3. Open the script and modify the following variables in the `main()` function:
   - `baseUrl`: Set this to the URL of the manga series you want to scrape.
   - `startChapter`: Set the first chapter number you want to scrape.
   - `endChapter`: Set the last chapter number you want to scrape.

4. Run the script:
   ```
   node script_name.js
   ```

## Output

The script will generate two types of output:

1. A JSON file named `asurascans.json` or `drakescans.json` containing all the scraped chapter data.
2. PDF files for each chapter, named `chapter_X.pdf` where X is the chapter number.

## Customization

You can customize the script by modifying the following:

- Change the output file names in the `saveData()` and `generatePDFs()` methods.
- Adjust the delay between requests in the `scrapeChapters()` method to respect the website's rate limits.

## Disclaimer

This script is for educational purposes only. Make sure you have the right to download and use the content you're scraping. Always respect the website's terms of service and robot.txt file.

## Contributing

Feel free to fork this repository and submit pull requests for any improvements or bug fixes.

## License

This project is open source and available under the [MIT License](LICENSE).
