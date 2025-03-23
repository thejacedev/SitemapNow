import fs from 'fs';
import path from 'path';
import { parseStringPromise } from 'xml2js';
import fetch from 'node-fetch';
import chalk from 'chalk';
import { URL } from 'url';

// Interface for options passed to processSitemap
interface SitemapOptions {
  key?: string;
  site?: string;
  engine?: string;
}

// Function to extract URLs from a sitemap
async function extractUrlsFromSitemap(sitemapContent: string): Promise<string[]> {
  try {
    const result = await parseStringPromise(sitemapContent);
    
    if (result.urlset && result.urlset.url) {
      return result.urlset.url.map((urlObj: any) => urlObj.loc[0]);
    } else if (result.sitemapindex && result.sitemapindex.sitemap) {
      // Handle sitemap index (collection of sitemaps)
      const childSitemapUrls = result.sitemapindex.sitemap.map((sitemap: any) => sitemap.loc[0]);
      const allUrls: string[] = [];
      
      for (const childSitemapUrl of childSitemapUrls) {
        try {
          console.log(chalk.blue(`  Fetching child sitemap: ${childSitemapUrl}`));
          const response = await fetch(childSitemapUrl);
          const childSitemapContent = await response.text();
          const childUrls = await extractUrlsFromSitemap(childSitemapContent);
          allUrls.push(...childUrls);
        } catch (error) {
          console.error(chalk.red(`  Error processing child sitemap ${childSitemapUrl}:`), error);
        }
      }
      
      return allUrls;
    }
    
    return [];
  } catch (error) {
    console.error(chalk.red('Error parsing sitemap XML:'), error);
    throw new Error('Invalid sitemap format');
  }
}

// Function to read sitemap content from a URL or file
async function getSitemapContent(sitemapLocation: string): Promise<string> {
  try {
    // Check if the location is a URL
    if (sitemapLocation.startsWith('http://') || sitemapLocation.startsWith('https://')) {
      console.log(chalk.blue(`  Fetching sitemap from URL: ${sitemapLocation}`));
      const response = await fetch(sitemapLocation);
      return await response.text();
    } else {
      // Assume it's a local file path
      console.log(chalk.blue(`  Reading sitemap from file: ${sitemapLocation}`));
      const absolutePath = path.resolve(sitemapLocation);
      return fs.readFileSync(absolutePath, 'utf-8');
    }
  } catch (error) {
    console.error(chalk.red('Error fetching sitemap:'), error);
    throw new Error(`Could not retrieve sitemap from ${sitemapLocation}`);
  }
}

// Function to submit URLs to IndexNow
async function submitUrlsToIndexNow(
  urls: string[],
  host: string,
  key: string,
  searchEngine?: string
): Promise<any> {
  // Default search engine if not specified
  const engine = searchEngine || 'api.indexnow.org';
  
  // Build the URL for the API
  const apiUrl = `https://${engine}/indexnow`;
  
  // If there's only one URL, use the simpler GET method
  if (urls.length === 1) {
    const singleUrl = `${apiUrl}?url=${encodeURIComponent(urls[0])}&key=${key}`;
    console.log(chalk.blue(`  Submitting single URL to IndexNow: ${urls[0]}`));
    
    const response = await fetch(singleUrl);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`IndexNow API returned ${response.status}: ${errorText}`);
    }
    
    return await response.text();
  }
  
  // For multiple URLs, use the POST method with JSON payload
  console.log(chalk.blue(`  Submitting ${urls.length} URLs to IndexNow via POST request`));
  
  // Process URLs in batches of 10,000 (API limit)
  const results = [];
  
  for (let i = 0; i < urls.length; i += 10000) {
    const batch = urls.slice(i, i + 10000);
    console.log(chalk.blue(`  Submitting batch ${Math.floor(i / 10000) + 1} of ${Math.ceil(urls.length / 10000)}...`));
    
    const payload = {
      host,
      key,
      urlList: batch
    };
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`IndexNow API returned ${response.status}: ${errorText}`);
    }
    
    results.push(await response.text());
  }
  
  return results;
}

// Main function to process sitemap and submit URLs
export async function processSitemap(sitemapLocation: string, options: SitemapOptions): Promise<void> {
  console.log(chalk.green('\n📊 Processing sitemap from'), chalk.cyan(sitemapLocation));
  
  // Get sitemap content
  const sitemapContent = await getSitemapContent(sitemapLocation);
  
  // Extract URLs from sitemap
  const urls = await extractUrlsFromSitemap(sitemapContent);
  
  if (urls.length === 0) {
    console.log(chalk.yellow('⚠️ No URLs found in the sitemap.'));
    return;
  }
  
  console.log(chalk.green(`✅ Found ${urls.length} URLs in the sitemap.`));
  
  // Print first 5 URLs as a sample
  console.log(chalk.blue('  Sample URLs:'));
  urls.slice(0, 5).forEach((url, index) => {
    console.log(chalk.cyan(`   ${index + 1}. ${url}`));
  });
  if (urls.length > 5) {
    console.log(chalk.cyan(`   ... and ${urls.length - 5} more`));
  }
  
  // Check if IndexNow API key is provided
  if (!options.key) {
    console.log(chalk.yellow('⚠️ IndexNow API key not provided. Please provide a key using the -k or --key option.'));
    return;
  }
  
  // Validate API key format (8-128 hexadecimal characters)
  const keyRegex = /^[a-zA-Z0-9\-]{8,128}$/;
  if (!keyRegex.test(options.key)) {
    throw new Error('Invalid API key format. The key must have 8-128 characters (a-z, A-Z, 0-9, or -).');
  }
  
  // Determine host from the first URL if not provided
  let host = options.site;
  if (!host && urls.length > 0) {
    try {
      const firstUrl = new URL(urls[0]);
      host = firstUrl.hostname;
    } catch (error) {
      console.error(chalk.red('Error parsing URL:'), error);
      throw new Error('Could not determine host from URLs. Please provide a host using the -s or --site option.');
    }
  }
  
  if (!host) {
    throw new Error('Host not provided. Please specify a host using the -s or --site option.');
  }
  
  // Submit URLs to IndexNow
  console.log(chalk.green('\n🚀 Submitting URLs to IndexNow for host:'), chalk.cyan(host));
  console.log(chalk.yellow(`⚠️ Note: Ensure you have a key file at https://${host}/${options.key}.txt containing your key!`));
  
  try {
    const result = await submitUrlsToIndexNow(urls, host, options.key, options.engine);
    
    console.log(chalk.green('\n✅ IndexNow submission result:'), result);
    console.log(chalk.green.bold('\n🎉 All URLs submitted successfully!'));
  } catch (error) {
    console.error(chalk.red('\n❌ Error submitting URLs to IndexNow:'), error);
    throw new Error('Failed to submit URLs to IndexNow');
  }
} 