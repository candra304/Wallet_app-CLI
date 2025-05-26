// index.js 💰
import fs from 'fs';
import { config } from 'dotenv';
import { ethers } from 'ethers';
import chalk from 'chalk';
import readline from 'readline';
import Table from 'cli-table3';

// Load environment variables
config();

// Function to generate random hex color
const getRandomColor = () => {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
};

// Generate network colors dynamically
const generateNetworkColors = (networkNames) => {
  const colors = {};
  networkNames.forEach(name => {
    colors[name] = chalk.hex(getRandomColor());
  });
  return colors;
};

// Parse RPCs from ENV
const rpcMap = process.env.RPCS.split(',')
  .map(entry => {
    const [name, url] = entry.split('=');
    return { name: name?.trim(), url: url?.trim() };
  }).filter(r => r.name && r.url);

// Generate colors for each network
const rpcColors = generateNetworkColors(rpcMap.map(r => r.name));

// Load private keys with better error handling
let privateKeys = [];
try {
  const pkFile = fs.readFileSync('pk.txt', 'utf-8');
  privateKeys = pkFile.split('\n')
    .map(x => x.trim())
    .filter(x => x && x.length === 64 || x.startsWith('0x'));
} catch (err) {
  console.error(chalk.red('Error reading private keys:'), err.message);
  process.exit(1);
}

// Load contracts
let contracts = [];
if (fs.existsSync('contracts.txt')) {
  try {
    contracts = fs.readFileSync('contracts.txt', 'utf-8')
      .split('\n')
      .map(line => {
        const [name, address] = line.split(':');
        return { name: name?.trim(), address: address?.trim() };
      })
      .filter(c => c.name && c.address && ethers.isAddress(c.address));
  } catch (err) {
    console.error(chalk.yellow('Warning: Error reading contracts:'), err.message);
  }
}

// Display banner
console.clear();
console.log(
  chalk.hex('#FF69B4').bold('[ WALLET APP ]') +
  `\n${chalk.white('   ___by candra__')}`
);
console.log(chalk.bold.green(`\n💰 EVM Wallet Monitor CLI 💰\n`));

// Show network list (only names with random colors)
console.log(chalk.yellow('Pilih jaringan yang ingin ditampilkan:\n'));
rpcMap.forEach((rpc, index) => {
  const colorFn = rpcColors[rpc.name] || chalk.white;
  console.log(`${index + 1}. ${colorFn(rpc.name)}`);
});

// User input function
const askInput = async (question) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => rl.question(question, ans => {
    rl.close();
    resolve(ans.trim());
  }));
};

// Main monitoring function
const runMonitor = async () => {
  try {
    const choice = await askInput('\nMasukkan nomor jaringan: ');
    const selected = rpcMap[parseInt(choice) - 1];
    
    if (!selected) {
      console.log(chalk.red('Pilihan tidak valid.'));
      return;
    }

    console.log(chalk.hex('#FF69B4').bold('\n[ Tunggu dulu bang, lagi loading 😋 ]\n'));

    const provider = new ethers.JsonRpcProvider(selected.url);
    const colorFn = rpcColors[selected.name] || chalk.white;

    // Verify connection
    try {
      await provider.getBlockNumber();
      console.log(chalk.blue.bold(`\nNetwork: ${colorFn(selected.name)}\n`));
    } catch (err) {
      console.log(chalk.red(`Gagal koneksi ke RPC ${selected.name}`));
      console.error(chalk.red('Error details:'), err.message);
      return;
    }

    // First pass to check which tokens have balances
    const tokensWithBalances = new Set();
    if (contracts.length > 0) {
      for (const pk of privateKeys) {
        try {
          const wallet = new ethers.Wallet(pk, provider);
          const address = wallet.address;
          
          for (const [i, contract] of contracts.entries()) {
            try {
              const abi = [
                "function balanceOf(address) view returns (uint)",
                "function decimals() view returns (uint8)"
              ];
              const token = new ethers.Contract(contract.address, abi, provider);
              const [balRaw, decimals] = await Promise.all([
                token.balanceOf(address),
                token.decimals()
              ]);
              const human = parseFloat(ethers.formatUnits(balRaw, decimals));
              if (human > 0) {
                tokensWithBalances.add(i);
              }
            } catch {}
          }
        } catch {}
      }
    }

    // Prepare table headers
    const headers = [
      chalk.bold.yellow('No'),
      chalk.bold.white('Wallet'),
      chalk.bold.cyan(`${selected.name} Balance`)
    ];
    
    // Only include tokens that have balances
    const visibleContracts = contracts.filter((_, i) => tokensWithBalances.has(i));
    if (visibleContracts.length > 0) {
      headers.push(...visibleContracts.map(c => chalk.magenta.bold(c.name)));
    }

    // Create table
    const table = new Table({
      head: headers,
      colWidths: [4, 44, 20, ...Array(visibleContracts.length).fill(20)],
      style: { border: [], head: [] },
      chars: {
        top: chalk.yellow('═'),
        'top-mid': chalk.yellow('╤'),
        'top-left': chalk.yellow('╔'),
        'top-right': chalk.yellow('╗'),
        bottom: chalk.yellow('═'),
        'bottom-mid': chalk.yellow('╧'),
        'bottom-left': chalk.yellow('╚'),
        'bottom-right': chalk.yellow('╝'),
        left: chalk.yellow('║'),
        'left-mid': chalk.yellow('╟'),
        mid: chalk.yellow('─'),
        'mid-mid': chalk.yellow('┼'),
        right: chalk.yellow('║'),
        'right-mid': chalk.yellow('╢'),
        middle: chalk.yellow('│')
      }
    });

    // Process each private key
    for (const [i, pk] of privateKeys.entries()) {
      try {
        // Validate and create wallet
        const wallet = new ethers.Wallet(pk, provider);
        const address = wallet.address;
        
        // Get balance with retry logic
        let balance;
        let retries = 3;
        
        while (retries > 0) {
          try {
            balance = await provider.getBalance(address);
            break;
          } catch (err) {
            retries--;
            if (retries === 0) throw err;
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        const native = parseFloat(ethers.formatEther(balance));
        let tokenBalances = [];

        // Get token balances for visible contracts only
        for (const [index, contract] of contracts.entries()) {
          if (tokensWithBalances.has(index)) {
            try {
              const abi = [
                "function balanceOf(address) view returns (uint)",
                "function decimals() view returns (uint8)"
              ];
              const token = new ethers.Contract(contract.address, abi, provider);
              const [balRaw, decimals] = await Promise.all([
                token.balanceOf(address),
                token.decimals()
              ]);
              const human = parseFloat(ethers.formatUnits(balRaw, decimals));
              
              // Special color handling for OG network
              if (selected.name === 'OG') {
                tokenBalances.push(human > 0 ? chalk.whiteBright(human.toFixed(4)) : '');
              } else {
                tokenBalances.push(human > 0 ? chalk.green(human.toFixed(4)) : '');
              }
            } catch {
              tokenBalances.push('');
            }
          }
        }

        // Special color handling for OG native balance
        table.push([
          i + 1, // Simplified number display
          chalk.green(address),
          selected.name === 'OG'
            ? (native > 0 ? chalk.whiteBright(native.toFixed(4)) : chalk.red('0'))
            : (native > 0 ? colorFn(native.toFixed(4)) : chalk.gray('0')),
          ...tokenBalances
        ]);
      } catch (err) {
        console.error(chalk.yellow(`Error processing key ${i + 1}:`), err.message);
        table.push([
          i + 1,
          chalk.red('Invalid PK'),
          'Error',
          ...Array(visibleContracts.length).fill('')
        ]);
      }
    }

    console.log(table.toString());
  } catch (err) {
    console.error(chalk.red('Unexpected error:'), err);
  }
};

// Run the monitor
await runMonitor();
