# zen_livejournal_migrate
Migrate your posts from Livejournal to Yandex.Zen

## How to use
Install last stable version of [NodeJS](https://nodejs.org) and npm.

Use bash in Linux, Terminal in MacOs and cmd.exe in Windows
```
$ npm install
```
If you use Windows execute following command ( this can take a while and throw some errors )
```
$ npm install --global --production windows-build-tools
```
Open config.yml in any text editor and change default params to yours.
```
zen:
  id: YOUR_ID
  username: YOUR_USERNAME
  password: YOUR_PASSWORD
  upload_idle: 10000
  captcha_idle: 15000
livejournal:
  user: YOUR_NICK
  date_start: 2010-01
  date_end: 2022-01
```
We are good to go.
```
$ node index.js
```
Script idle before send posts to zen for image uploading. Also where is idle before posting for captcha.
