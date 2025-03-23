#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { processSitemap } from './sitemap.js';

const program = new Command();

// Define ASCII art logo
const logo = `
   _____ _ _                           _   _               
  / ____(_) |                         | \\ | |              
 | (___  _| |_ ___ _ __ ___   __ _ _ _|  \\| | _____      __
  \\___ \\| | __/ _ \\ '_ \` _ \\ / _\` | '_ \\ . \` |/ _ \\ \\ /\\ / /
  ____) | | ||  __/ | | | | | (_| | |_) | |\\  | (_) \\ V  V / 
 |_____/|_|\\__\\___|_| |_| |_|\\__,_| .__/|_| \\_|\\___/ \\_/\\_/  
                                  | |                       
                                  |_|                       
`;

// Main function to run interactive CLI
async function runInteractiveCLI() {
  console.log(chalk.cyan(logo));
  console.log(chalk.bold.green('Welcome to SitemapNow - Submit URLs from a sitemap to IndexNow\n'));
  
  // Get user input using inquirer
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'sitemapLocation',
      message: chalk.yellow('Enter the URL or file path to your sitemap:'),
      validate: (value) => {
        if (value.trim().length > 0) return true;
        return 'Please enter a valid sitemap URL or file path';
      }
    },
    {
      type: 'input',
      name: 'key',
      message: chalk.yellow('Enter your IndexNow API key:'),
      validate: (value) => {
        if (/^[a-zA-Z0-9\-]{8,128}$/.test(value)) return true;
        return 'API key must be 8-128 characters and contain only alphanumeric characters and dashes';
      }
    },
    {
      type: 'input',
      name: 'site',
      message: chalk.yellow('(Optional) Enter your website host (e.g., example.com):'),
      default: ''
    },
    {
      type: 'input',
      name: 'engine',
      message: chalk.yellow('(Optional) Search engine to submit to:'),
      default: 'api.indexnow.org'
    }
  ]);
  
  try {
    console.log(chalk.blue('\nProcessing your request...'));
    await processSitemap(answers.sitemapLocation, answers);
  } catch (error) {
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Define commander options for command-line usage
program
  .name('sitemapnow')
  .description('Submit URLs from a sitemap to IndexNow')
  .version('1.0.0')
  .option('-i, --interactive', 'Run in interactive mode with prompts')
  .option('-s, --sitemap <sitemapLocation>', 'URL or file path to a sitemap')
  .option('-k, --key <apiKey>', 'IndexNow API key')
  .option('-h, --host <siteHost>', 'Host of the website (if different from sitemap host)')
  .option('-e, --engine <searchEngine>', 'Search engine to submit to (default: api.indexnow.org)')
  .action(async (options) => {
    // If interactive flag is set or no options provided, run interactive mode
    if (options.interactive || (!options.sitemap && !options.key)) {
      await runInteractiveCLI();
      return;
    }
    
    // Otherwise use command line arguments
    if (!options.sitemap) {
      console.error(chalk.red('Error: Sitemap location is required'));
      process.exit(1);
    }
    
    if (!options.key) {
      console.error(chalk.red('Error: IndexNow API key is required'));
      process.exit(1);
    }
    
    try {
      await processSitemap(options.sitemap, {
        key: options.key,
        site: options.host,
        engine: options.engine
      });
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program.parse(process.argv); 