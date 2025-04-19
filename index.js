// index.js 💰
import fs from 'fs';
import { config } from 'dotenv';
import { ethers } from 'ethers';
import chalk from 'chalk';
import readline from 'readline';
import Table from 'cli-table3';

config();

// Warna khusus per jaringan
const rpcColors = {
  Seismic: chalk.hex('#FF69B4'),   // Pink
  ETHFLUENT: chalk.cyan,
  ETHRISE: chalk.green
};

// Parsing RPCS dari ENV
const rpcMap = process.env.RPCS.split(',')
  .map(entry => {
    const [name, url] = entry.split('=');
    return { name: name.trim(), url: url.trim() };
  }).filter(r => r.name && r.url);

// Load private keys
const privateKeys = fs.readFileSync('pk.txt', 'utf-8')
  .split('\n').map(x => x.trim()).filter(Boolean);

// Load contracts
let contracts = [];
if (fs.existsSync('contracts.txt')) {
  contracts = fs.readFileSync('contracts.txt', 'utf-8')
    .split('\n').map(line => {
      const [name, address] = line.split(':');
      return { name: name?.trim(), address: address?.trim() };
    }).filter(c => c.name && c.address);
}

// Banner
console.clear();
console.log(
  chalk.hex('#FF69B4').bold('[ WALLET APP ]') +
  `\n${chalk.white('   ___by candra__')}`
);
console.log(chalk.bold.green(`\n💰 EVM Wallet Monitor CLI 💰\n`));

// Tampilkan daftar jaringan
console.log(chalk.yellow('Pilih jaringan yang ingin ditampilkan:\n'));
rpcMap.forEach((rpc, index) => {
  const colorFn = rpcColors[rpc.name] || chalk.white;
  console.log(`${index + 1}. ${colorFn(rpc.name)}`);
});

// Fungsi input user
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

const runMonitor = async () => {
  const choice = await askInput('\nMasukkan nomor jaringan: ');
  const selected = rpcMap[parseInt(choice) - 1];
  if (!selected) {
    console.log(chalk.red('Pilihan tidak valid.'));
    return;
  }

  console.log(chalk.hex('#FF69B4').bold('\n[ Tunggu dulu bang, lagi loading 😋 ]\n'));

  const provider = new ethers.JsonRpcProvider(selected.url);
  const colorFn = rpcColors[selected.name] || chalk.white;

  try {
    await provider.getBlockNumber();
    console.log(chalk.blue.bold(`\nRPC: ${selected.url} (${selected.name})\n`));
  } catch {
    console.log(chalk.red(`Gagal koneksi ke RPC ${selected.name}: ${selected.url}`));
    return;
  }

  // Header tabel
  const headers = [
    chalk.bold.yellow('No.'),
    chalk.bold.white('Wallet'),
    chalk.bold.cyan(`${selected.name} Balance`)
  ];
  if (contracts.length > 0) {
    headers.push(...contracts.map(c => chalk.magenta.bold(c.name)));
  }

  // Tabel dengan border tebal & warna
  const table = new Table({
    head: headers,
    colWidths: [6, 44, 20, ...Array(contracts.length).fill(20)],
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

  let index = 1;
  for (const pk of privateKeys) {
    try {
      const wallet = new ethers.Wallet(pk, provider);
      const address = await wallet.getAddress();
      const balance = await provider.getBalance(address);
      const native = parseFloat(ethers.formatEther(balance));

      let tokenBalances = [];

      if (contracts.length > 0) {
        for (const contract of contracts) {
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
            tokenBalances.push(human > 0 ? chalk.green(human.toFixed(4)) : chalk.gray('0'));
          } catch {
            tokenBalances.push(chalk.red('ERR'));
          }
        }
      }

      table.push([
        chalk.bold.white(index++),
        chalk.green(address),
        native > 0 ? colorFn(native.toFixed(4)) : chalk.gray('0'),
        ...tokenBalances
      ]);
    } catch {
      table.push([
        chalk.bold.white(index++),
        chalk.red('Invalid PK'),
        'Error',
        ...contracts.map(() => 'X')
      ]);
    }
  }

  console.log(table.toString());
};

await runMonitor();
