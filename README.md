# Home Sweet Home Online : Luncher Soure [ใครโหลดไปใช้กรุณาให้ Credit LYWP Team ด้วย]

This is the private launcher server of the game **Home Sweet Home Online** It runs through Reverse Proxy and Render.com

**Important**: You must own Home Sweet Home: Online in your Steam library (available before Jan 31, 2025) to use this server This repo might be maintained just for some funnies

## Prerequisites

- Home Sweet Home: Online in your Steam library (acquired before Jan 31, 2025)
- [Node.js](https://nodejs.org/) (Latest LTS version recommended)
- [MongoDB Account](https://www.mongodb.com/) (Free tier works fine, this is only for saving your 'progress')
- [Steam Web API Key](https://steamcommunity.com/dev/apikey)
- [Render](https://render.com/) (If it opens as a public server)

## Installation

### 1. Download the Repository

```
<Code>
 L Download Zip

 ```
### 2.Set MongoDB

**MongoDB Atlas (Database on Cloud)** Settings
Since the Render service in the free plan does not have a built-in persistent database system, the MongoDB Atlas is recommended (512 MB free)

1. Apply/Access at MongoDB Atlas

2. Create Database Cluster (Choose Free/Shared M0 Plan)

3. Set up Network Access (IP Access List):

 - Go to the Network Access bar on the left

 -  Press Add IP Address

 - Select Allow Access From Anywhere (0.0.0.0/0) so Render can connect, and press Confirm

4. Set Database User:

 - Go to Database Access bar

 - Press Add New Database User

 - Set Username and Password (take note of this key) and press Add User

5. Pull Connection String (Mongo URI):

 - Go to the Database page, press the Connect button on your Cluster

 - Select Drivers (Node.js)

 - Copy the Connection String link which will be in the form:
 ```
mongodb+srv://<username>:<password>@cluster0.xxx.mongodb.net/<dbname>?retryWrites=true&w=majority
```

 - Change <username>, <password> and <dbname> to your real data

### 3.Set .ENV
**Creating and setting up.env files**
The.env file is used to store Sensitive Data such as Secret Key and Database URI so that they do not fall out in the Public Repository

**Create an.env file in the project's Root Folder**
Example of content in an.env file:Code information
```
MONGO_URI=YOUR_MONGO_URL
MONGO_DB_NAME=HSHO
JWT_SECRET=very-good-key
STEAM_API_KEY=YOUR_STEAM_API_KEY
PORT=3000
```
3.1 Create a.gitignore file (very important!)
Create a file named.gitignore at Root Folder to prevent GitHub from pulling an.env or node_modules file online:
```
node_modules/
.env
dist/
certs/*.key
certs/*.crt
```
Diractory
```
HSHO_Luncher
L .env
L main.js
L preload.js
L renderer.js
L package.js
L bg.jpg <= พื้นหลัง
L icon.ico <= ไอคอนลันเชอร์
```
Paste in CMD on Visual Code Studio
```
npm install electron-updater node-forge extract-zip adm-zip axios systeminformation

```


