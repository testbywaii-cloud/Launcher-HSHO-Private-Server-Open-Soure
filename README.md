# Home Sweet Home Online : Luncher Soure

This is the private launcher server of the game **Home Sweet Home Online** It runs through Client Proxy and Render

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

**MongoDB Atlas (Database on Cloud) Settings**
Since the Render service in the free plan does not have a built-in persistent database system, the MongoDB Atlas is recommended (512 MB free)

1.Apply/Access at MongoDB Atlas

2.Create Database Cluster (Choose Free/Shared M0 Plan)

3.Set up Network Access (IP Access List):

 - Go to the Network Access bar on the left

 -  Press Add IP Address

 - Select Allow Access From Anywhere (0.0.0.0/0) so Render can connect, and press Confirm

Set Database User:

Go to Database Access bar

Press Add New Database User

Set Username and Password (take note of this key) and press Add User

Pull Connection String (Mongo URI):

Go to the Database page, press the Connect button on your Cluster

Select Drivers (Node.js)

Copy the Connection String link which will be in the form:
mongodb+srv://<username>:<password>@cluster0.xxx.mongodb.net/<dbname>?retryWrites=true&w=majority

Change <username>, <password> and <dbname> to your real data
