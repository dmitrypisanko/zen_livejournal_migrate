'use strict';

const puppeteer = require('puppeteer'),
    fs = require('fs'),
    yaml = require('js-yaml');

try {
    const config = yaml.safeLoad(fs.readFileSync('./config.yml', 'utf8'));
    main(config);
} catch (e) {
    console.log(e);
    process.exit();
}

async function main(config) {
    const lastIdFile = './last_id.txt';

    let lastId = parseInt(fs.readFileSync(lastIdFile).toString());

    console.log('Start');
    console.log(`Last livejournal post id ${lastId}`);

    const browser = await puppeteer.launch({headless: false});

    const page1 = await browser.newPage();
    const page2 = await browser.newPage();

    await page1.setViewport({
        'width': 1920,
        'height': 1080,
    });

    await page2.setViewport({
        'width': 1920,
        'height': 1080,
        'isMobile': true,
    });

    console.log('Login to Yandex.Zen');

    await page1.bringToFront();

    await page1.goto('https://passport.yandex.ru/auth?retpath=https%3A%2F%2Fzen.yandex.ru%2Fmedia%2Fzen%2Flogin', {
        waituntil: "networkidle"
    });

    await page1.type('input[name=login]', config.zen.username, {delay: 50});
    await page1.type('input[name=passwd]', config.zen.password, {delay: 50});

    await page1.$eval('button', async (el) => {
        return el.click();
    });

    await page1.waitFor(1000);

    await page1.goto(`https://zen.yandex.ru/media/${config.zen.id}`, {
        waituntil: "networkidle"
    });

    let [startYear, startMonth] = config.livejournal.date_start.split("-");
    let [endYear, endMonth] = config.livejournal.date_end.split("-");

    startMonth = parseInt(startMonth);
    endMonth = parseInt(endMonth);

    for(let year=startYear;year<=endYear;year++) {
        for(let month=startMonth;month<=12;month++) {
            await page2.bringToFront();

            const nick = config.livejournal.user.replace(/_/g, '-');
            const date = `${year}-${month}`;
            const url = `https://${nick}.livejournal.com/${year}/${month < 10 ? '0' + month : month}/`;

            console.log(`Start parsing ${date}. Check archive ${url}`);

            await page2.goto(url, {
                waituntil: "networkidle"
            });

            await page2.waitFor(1000);

            const body = await page2.content();
            const regex = new RegExp(`a href="https:\/\/${nick}\.livejournal\.com\/(.[^\.]+?).html`, 'g');

            let m;
            while(m = regex.exec(body)) {
                await page2.bringToFront();

                const postId = parseInt(m[0].split("/").pop().replace('.html', ''));

                if (postId > lastId) {
                    lastId = postId;
                    console.log(`Post #${postId}. Parse It`);

                    await page2.goto(`http://m.livejournal.com/read/user/${nick}/${postId}`, {
                        waituntil: "networkidle"
                    });

                    await page2.waitFor(500);
                    await page2.$eval('div[class="b-ads"]', async (el) => {
                        return el.remove();
                    });

                    try {
                        await page2.waitFor(500);
                        await page2.$eval('div[class="image-babber-place"]', async (el) => {
                            return el.remove();
                        });
                    } catch (err) {}

                    await page2.waitFor(500);

                    const subject = (await page2.evaluate(() => document.querySelector('h3[class="item-header"]').textContent)).trim();

                    console.log(`Found subject: ${subject}`);

                    const block = await page2.evaluate(() => {
                        const rect = document.querySelector('div[class="item-text"]').getBoundingClientRect();

                        return {
                            left: rect.left,
                            right: rect.right,
                            bottom: rect.bottom,
                            top: rect.top,
                        };
                    });

                    console.log(`Select and copy post content`);

                    await page2.waitFor(500);
                    await page2.mouse.click(300, 300, {delay: 50});
                    await page2.waitFor(500);

                    await page2.mouse.move(block.left - 2, block.top - 2, {delay: 50});
                    await page2.waitFor(100);
                    await page2.mouse.down();
                    await page2.mouse.move(block.right, block.bottom);
                    await page2.mouse.up();

                    await page2.keyboard.down('Control');
                    await page2.keyboard.down('c');
                    await page2.keyboard.up('c');
                    await page2.keyboard.up('Control');

                    await page2.waitFor(1000);

                    console.log(`Post to Zen`);

                    await page1.bringToFront();

                    await page1.$eval('button[class="button2 button2_view_classic button2_size_m button2_theme_zen-dropdown-item header__popup-add-button header__popup-add-button_article"]', async (el) => {
                        return el.click();
                    });

                    await page1.waitFor(1000);

                    // Type subject
                    await page1.mouse.click(620, 165, {delay: 50});
                    await page1.waitFor(200);
                    await page1.keyboard.type(subject, {delay: 50});
                    await page1.waitFor(200);

                    // Paste content
                    await page1.keyboard.down('Tab');
                    await page1.keyboard.down('Control');
                    await page1.keyboard.down('v');
                    await page1.keyboard.up('v');
                    await page1.keyboard.up('Control');

                    console.log(`Wait for uploading photos. You can change timeout manually in config`);
                    await page1.waitFor(config.zen.upload_idle);

                    // Send to Zen
                    await page1.$eval('button', async (el) => {
                        return el.focus();
                    });

                    await page1.$eval('button', async (el) => {
                        return el.click();
                    });

                    // Confirm post
                    await page1.$eval('button[class="button2 button2_view_classic button2_size_m button2_theme_zen publish-popup__publish-button"]', async (el) => {
                        return el.click();
                    });

                    // Idle for CAPTCHA
                    console.log(`Wait before publish. You can change timeout manually in config`);
                    await page1.waitFor(config.zen.captcha_idle);

                    //save last post id to file
                    fs.writeFileSync(lastIdFile, postId);
                } else {
                    console.log(`Post #${postId} skipped`);
                }
            }
        }
    }

    console.log(`Kill process`);
    process.exit();
}