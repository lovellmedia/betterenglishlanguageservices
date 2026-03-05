#!/usr/bin/env node

const https = require('https');
const querystring = require('querystring');

// Load environment variables
require('dotenv').config();

const NAMECHEAP_API_KEY = process.env.NAMECHEAP_API_KEY;
const NAMECHEAP_API_USER = process.env.NAMECHEAP_API_USER;
const NAMECHEAP_CLIENT_IP = process.env.NAMECHEAP_CLIENT_IP;
const DOMAIN = process.env.DOMAIN;

if (!NAMECHEAP_API_KEY || !NAMECHEAP_API_USER || !NAMECHEAP_CLIENT_IP || !DOMAIN) {
  console.error('Missing required environment variables');
  process.exit(1);
}

// Parse domain into SLD and TLD
const [sld, ...tldParts] = DOMAIN.split('.');
const tld = tldParts.join('.');

console.log(`Configuring DNS for ${DOMAIN} (SLD: ${sld}, TLD: ${tld})`);

// Step 1: Set DNS to Namecheap BasicDNS
function setDefaultDNS() {
  return new Promise((resolve, reject) => {
    const params = {
      ApiUser: NAMECHEAP_API_USER,
      ApiKey: NAMECHEAP_API_KEY,
      UserName: NAMECHEAP_API_USER,
      ClientIp: NAMECHEAP_CLIENT_IP,
      Command: 'namecheap.domains.dns.setDefault',
      SLD: sld,
      TLD: tld
    };

    const queryStr = querystring.stringify(params);
    const url = `https://api.namecheap.com/api/v2/domains/dns/setDefault?${queryStr}`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (data.includes('success')) {
          console.log('✓ DNS set to Namecheap BasicDNS');
          resolve();
        } else {
          reject(new Error('Failed to set DNS: ' + data));
        }
      });
    }).on('error', reject);
  });
}

// Step 2: Wait for propagation
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Step 3: Get current DNS records
function getHosts() {
  return new Promise((resolve, reject) => {
    const params = {
      ApiUser: NAMECHEAP_API_USER,
      ApiKey: NAMECHEAP_API_KEY,
      UserName: NAMECHEAP_API_USER,
      ClientIp: NAMECHEAP_CLIENT_IP,
      Command: 'namecheap.domains.dns.getHosts',
      SLD: sld,
      TLD: tld
    };

    const queryStr = querystring.stringify(params);
    const url = `https://api.namecheap.com/api/v2/domains/dns/getHosts?${queryStr}`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('✓ Retrieved current DNS records');
        resolve(data);
      });
    }).on('error', reject);
  });
}

// Step 4: Set DNS records (A record for apex, CNAME for www)
function setHosts() {
  return new Promise((resolve, reject) => {
    const params = {
      ApiUser: NAMECHEAP_API_USER,
      ApiKey: NAMECHEAP_API_KEY,
      UserName: NAMECHEAP_API_USER,
      ClientIp: NAMECHEAP_CLIENT_IP,
      Command: 'namecheap.domains.dns.setHosts',
      SLD: sld,
      TLD: tld,
      'HostName1': '@',
      'RecordType1': 'A',
      'Address1': '75.2.60.5',
      'TTL1': '3600',
      'HostName2': 'www',
      'RecordType2': 'CNAME',
      'Address2': `${sld}.netlify.app`,
      'TTL2': '3600'
    };

    const queryStr = querystring.stringify(params);
    const url = `https://api.namecheap.com/api/v2/domains/dns/setHosts?${queryStr}`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (data.includes('success')) {
          console.log('✓ DNS records set successfully');
          console.log('  - A record (@): 75.2.60.5');
          console.log(`  - CNAME record (www): ${sld}.netlify.app`);
          resolve();
        } else {
          reject(new Error('Failed to set DNS records: ' + data));
        }
      });
    }).on('error', reject);
  });
}

// Execute steps
async function configureDNS() {
  try {
    console.log('\n=== Configuring Namecheap DNS ===\n');
    
    await setDefaultDNS();
    console.log('Waiting 3 seconds for propagation...');
    await wait(3000);
    
    await getHosts();
    await setHosts();
    
    console.log('\n✓ DNS configuration complete');
    console.log('Note: DNS changes may take 24-48 hours to fully propagate');
    console.log('SSL provisioning typically takes 5-30 minutes after DNS is live\n');
  } catch (error) {
    console.error('Error configuring DNS:', error.message);
    process.exit(1);
  }
}

configureDNS();
