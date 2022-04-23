const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

const UPLOAD_WAIT_MS = 3000;
const PROJECT_LOAD_WAIT_MS = 4000;

if (process.argv?.length < 5) {
    console.error(`Usage: ${process.argv[1]} <username> <password> <projectid> [/source/path]`);
    process.exit(1);
}

const VUFORIA_USERNAME = process.argv[2];
const VUFORIA_PASSWORD = process.argv[3];
const PROJECT_ID = process.argv[4];
const SOURCE_DIR = process.argv?.length >= 6 ? process.argv[5] : __dirname;


console.log(`Reading files from ${SOURCE_DIR}`);

fs.readdir(SOURCE_DIR, (err, files) => {
    if (err) {
      console.error("Could not list the directory.", err);
      process.exit(1);
    }
  
    const paths = files.map((file, index) => {
        const fromPath = path.join(SOURCE_DIR, file);
        const stat = fs.statSync(fromPath);
        if (stat.isFile() && (fromPath.toLocaleLowerCase().endsWith('.jpg') || fromPath.toLocaleLowerCase().endsWith('.jpeg'))) {
            return fromPath;
        } else {
            return null;
        }
    }).filter(o => !!o);


    if (!paths || paths.length < 1) {
        console.error('No JPEG files to upload');
        process.exit(1);
    } else {
        console.log('%i files queued for upload:', paths.length);
        console.log(paths);
        console.log('-------------------------------');

        (async () => {
            console.debug('Launching Chromium...');
            const executablePath = '/opt/homebrew/bin/chromium';
            console.log(executablePath);
            const browser = await puppeteer.launch({executablePath: executablePath});

            console.debug('Opening a new tab and loading Vuforia login page...');
            const page = await browser.newPage();
        
            await page.goto('https://developer.vuforia.com/vui/auth/login');
        
            await page.type('#login_email', VUFORIA_USERNAME);// your login email
            await page.type('#login_password', VUFORIA_PASSWORD);// your login password
        
            await page.click('#login');

            console.debug('Login submitted, waiting...');

            await page.waitForNavigation(); // <------------------------- Wait for Navigation



            // your url database
            const projectURL = `https://developer.vuforia.com/targetmanager/project/targets?projectId=${PROJECT_ID}&av=false`;
            console.debug(`Navigating to ${projectURL} ...`);
            await page.goto(projectURL);
        
            await sleep(PROJECT_LOAD_WAIT_MS);
        
            // await page.evaluate(() => {
            //     let dom = document.querySelector('tbody[class="table-list-tbody"]');
            //     dom.innerHTML = "change to something"
            // });
        
            // download all image database
            // await page.$eval( 'button#buttonsCreate', form => form.click() );
            // await page._client.send('Page.setDownloadBehavior', {
            //     behavior: 'allow', downloadPath: path.resolve(sourceDir, 'downloaded')});
            // await page.$eval( 'input#createlDownloadDatabaseBtn', form => form.click() );

            for (const [index, fromPath] of paths.entries()) {
                // upload image target
                console.debug(`Uploading ${index} of ${paths.length}: ${fromPath} ...`);
                await page.$eval( 'button#addDeviceTargetUserView', form => form.click() );
                const input = await page.$('input[type="file"]')
                await input.uploadFile(fromPath)// your local image path
                await page.$eval('#targetDimension', el => el.value = '1'); // width of your target in scene
                await page.$eval( 'button#AddDeviceTargetBtn', form => form.click() );
            
                await sleep(UPLOAD_WAIT_MS);

                // check for errors
                const errorElements = await page.$('.errorMessage');
                if (errorElements?.length > 0) {
                    for (errorMessage of errorElements) {
                        console.err(errorMessage);
                    }
                } else {
                    console.log('Success!');
                }
            }
       
            await browser.close();
        })();
    }
    
  });  

