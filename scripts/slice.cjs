// node scripts/slice.cjs <png> [sliceHeight]
const sharp = require("sharp");
const [, , file, h = "1300"] = process.argv;
(async () => {
  const m = await sharp(file).metadata();
  const H = Number(h);
  for (let i = 0, y = 0; y < m.height; i++, y += H)
    await sharp(file).extract({ left: 0, top: y, width: m.width, height: Math.min(H, m.height - y) }).toFile(file.replace(".png", `-${i}.png`));
  console.log(file, m.width, m.height, Math.ceil(m.height / H));
})();
