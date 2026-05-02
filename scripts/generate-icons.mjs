import sharp from 'sharp'
import fs from 'node:fs/promises'
import path from 'node:path'

async function generateIcons() {
  const svgPath = 'assets/icon.svg'
  const assetsDir = 'assets'

  // Ensure assets directory exists
  await fs.mkdir(assetsDir, { recursive: true })

  // Read SVG
  const svgBuffer = await fs.readFile(svgPath)

  // Generate PNG at multiple sizes
  const sizes = [16, 32, 48, 64, 128, 256, 512, 1024]
  const pngPaths = []

  for (const size of sizes) {
    const pngPath = path.join(assetsDir, `icon-${size}.png`)
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(pngPath)
    pngPaths.push(pngPath)
    console.log(`Generated ${pngPath}`)
  }

  // Generate ICO for Windows (needs 256x256 max typically, but include common sizes)
  const { default: pngToIco } = await import('png-to-ico')
  const icoBuffer = await pngToIco([
    path.join(assetsDir, 'icon-16.png'),
    path.join(assetsDir, 'icon-32.png'),
    path.join(assetsDir, 'icon-48.png'),
    path.join(assetsDir, 'icon-256.png'),
  ])
  const icoPath = path.join(assetsDir, 'icon.ico')
  await fs.writeFile(icoPath, icoBuffer)
  console.log(`Generated ${icoPath}`)

  // Generate ICNS for macOS
  const iconGen = await import('icon-gen')
  await iconGen.default(path.join(assetsDir, 'icon-1024.png'), assetsDir, {
    report: true,
    icns: {
      name: 'icon',
      sizes: [16, 32, 64, 128, 256, 512, 1024],
    },
  })
  console.log('Generated assets/icon.icns')

  console.log('\nAll icons generated successfully!')
}

generateIcons().catch((err) => {
  console.error('Failed to generate icons:', err)
  process.exit(1)
})
