
## fitur  
- Cek saldo wallet EVM  
- Multi jaringan RPC  
- Support token ERC20 (opsional)
  
## clone
```
git clone https://github.com/candra304/Wallet_app-CLI.git
```
## instalasi  
```
npm install
```
## file txt dan .env  
```
nano pk.txt  
0xPRIVATEKEY1  
0xPRIVATEKEY2  
```
```
nano contracts.txt  
USDC:0x123...  
DAI:0x456...  
```
```
nano .env  
RPCS=Seismic=https://rpc.seismic.xyz,ETHFLUENT=https://rpc.ethfluent.xyz,ETHRISE=https://rpc.ethrise.xyz
bisa di costum nama sesuai sc token dari masing masing rpc

## eksekusi
```
node index.js
```
