import addOnUISdk from "https://new.express.adobe.com/static/add-on-sdk/sdk.js";

addOnUISdk.ready.then(async () => {
    console.log("addOnUISdk is ready for use.");

    // Get the UI runtime.
    const { runtime } = addOnUISdk.instance;

    // Get the proxy object, which is required
    // to call the APIs defined in the Document Sandbox runtime
    // i.e., in the `code.js` file of this add-on.
    const sandboxProxy = await runtime.apiProxy("documentSandbox");

    const imageUpload = document.getElementById("imageUpload");
    const colorBar = document.getElementById("colorBar");
    const importButton = document.getElementById("importButton");
    const swapButton = document.getElementById("swapButton");
    const filePickerButton = document.getElementById("filePickerButton");
    const color1Preview = document.getElementById("color1Preview");
    const color2Preview = document.getElementById("color2Preview");
    const swapPreviewContainer = document.getElementById("swapPreviewContainer");
    const swapHelperText = document.getElementById("swapHelperText");
    
    if (!imageUpload) {
        console.error("Image upload element not found!");
        return;
    }
    if (!colorBar) {
        console.error("Color bar element not found!");
        return;
    }
    if (!importButton) {
        console.error("Import button element not found!");
        return;
    }
    if (!swapButton) {
        console.error("Swap button element not found!");
        return;
    }
    if (!filePickerButton) {
        console.error("File picker button element not found!");
        return;
    }
    
    console.log("Elements found, setting up event listener...");

    // State for color swap feature
    let selectedColorIndices = [];
    let currentPaletteData = []; // Array of {color: [r,g,b], percentage: number}
    let currentImage = null;
    let currentCanvas = null;
    let currentImageData = null;

    // Helper function to calculate color distance
    function colorDistance(rgb1, rgb2) {
        const [r1, g1, b1] = rgb1;
        const [r2, g2, b2] = rgb2;
        return Math.sqrt(
            Math.pow(r2 - r1, 2) + Math.pow(g2 - g1, 2) + Math.pow(b2 - b1, 2)
        );
    }

    // Helper function to find closest dominant color for a pixel
    function findClosestColor(pixelRgb, dominantColors) {
        let minDistance = Infinity;
        let closestIndex = 0;
        
        dominantColors.forEach((color, index) => {
            const distance = colorDistance(pixelRgb, color);
            if (distance < minDistance) {
                minDistance = distance;
                closestIndex = index;
            }
        });
        
        return closestIndex;
    }

    // Function to calculate color percentages from pixel data
    async function calculateColorPercentages(image, dominantColors) {
        return new Promise((resolve) => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            ctx.drawImage(image, 0, 0);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const pixels = imageData.data;
            const colorCounts = new Array(dominantColors.length).fill(0);
            const totalPixels = canvas.width * canvas.height;
            
            // Sample pixels (every 10th pixel for performance)
            const sampleRate = 10;
            let sampledPixels = 0;
            
            for (let i = 0; i < pixels.length; i += 4 * sampleRate) {
                const r = pixels[i];
                const g = pixels[i + 1];
                const b = pixels[i + 2];
                const pixelRgb = [r, g, b];
                
                const closestIndex = findClosestColor(pixelRgb, dominantColors);
                colorCounts[closestIndex]++;
                sampledPixels++;
            }
            
            // Calculate percentages
            const percentages = colorCounts.map(count => 
                (count / sampledPixels) * 100
            );
            
            resolve(percentages);
        });
    }

    // Function to convert RGB to hex
    function rgbToHex(r, g, b) {
        return "#" + [r, g, b].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? "0" + hex : hex;
        }).join("");
    }

    // Function to determine if color is light or dark (for text contrast)
    function isLightColor(r, g, b) {
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness > 128;
    }

    // Update swap button state based on selection
    function updateSwapButtonState() {
        const hasTwoColors = selectedColorIndices.length === 2;
        
        // Fix Spectrum Web Components button state using attributes
        if (hasTwoColors) {
            // Enable button: remove disabled attribute and set aria-disabled to false
            swapButton.removeAttribute("disabled");
            swapButton.setAttribute("aria-disabled", "false");
        } else {
            // Disable button: set disabled attribute and aria-disabled to true
            swapButton.setAttribute("disabled", "");
            swapButton.setAttribute("aria-disabled", "true");
        }
        
        // Update helper text
        if (hasTwoColors) {
            swapHelperText.style.opacity = "0.6";
            swapHelperText.textContent = "Ready to swap!";
        } else if (selectedColorIndices.length === 1) {
            swapHelperText.style.opacity = "1";
            swapHelperText.textContent = "Select one more color to enable swapping";
        } else {
            swapHelperText.style.opacity = "1";
            swapHelperText.textContent = "Select two colors to enable swapping";
        }
    }

    // Update preview boxes
    function updatePreviewBoxes() {
        if (!currentPaletteData || currentPaletteData.length === 0) {
            return;
        }
        
        // Clear preview boxes
        const existingColor1 = color1Preview.querySelector(".swap-preview-color");
        const existingColor2 = color2Preview.querySelector(".swap-preview-color");
        const placeholder1 = color1Preview.querySelector(".swap-preview-placeholder");
        const placeholder2 = color2Preview.querySelector(".swap-preview-placeholder");
        
        // Remove existing color divs
        if (existingColor1) existingColor1.remove();
        if (existingColor2) existingColor2.remove();
        
        // Reset classes
        color1Preview.classList.remove("has-color");
        color2Preview.classList.remove("has-color");
        swapPreviewContainer.classList.remove("has-colors");
        
        // Show placeholders
        if (!placeholder1) {
            const p1 = document.createElement("div");
            p1.className = "swap-preview-placeholder";
            p1.style.cssText = "color: var(--spectrum-global-color-gray-500); font-size: 10px; padding: 8px;";
            p1.textContent = "Select";
            color1Preview.appendChild(p1);
        } else {
            placeholder1.style.display = "block";
        }
        
        if (!placeholder2) {
            const p2 = document.createElement("div");
            p2.className = "swap-preview-placeholder";
            p2.style.cssText = "color: var(--spectrum-global-color-gray-500); font-size: 10px; padding: 8px;";
            p2.textContent = "Select";
            color2Preview.appendChild(p2);
        } else {
            placeholder2.style.display = "block";
        }
        
        // Update with selected colors
        if (selectedColorIndices.length >= 1 && currentPaletteData[selectedColorIndices[0]]) {
            const index1 = selectedColorIndices[0];
            const color1 = currentPaletteData[index1].color;
            const [r1, g1, b1] = color1;
            const hex1 = rgbToHex(r1, g1, b1);
            const textColor1 = isLightColor(r1, g1, b1) ? "#000000" : "#FFFFFF";
            
            if (placeholder1) placeholder1.style.display = "none";
            const div1 = document.createElement("div");
            div1.className = "swap-preview-color";
            div1.style.backgroundColor = hex1;
            div1.style.color = textColor1;
            
            // Create HEX value display
            const hexSpan1 = document.createElement("div");
            hexSpan1.className = "swap-preview-hex";
            hexSpan1.textContent = hex1.toUpperCase();
            hexSpan1.style.color = textColor1;
            
            // Create percentage display
            const percentSpan1 = document.createElement("div");
            percentSpan1.className = "swap-preview-percentage";
            percentSpan1.textContent = `${currentPaletteData[index1].percentage.toFixed(1)}%`;
            percentSpan1.style.color = textColor1;
            
            div1.appendChild(hexSpan1);
            div1.appendChild(percentSpan1);
            color1Preview.appendChild(div1);
            color1Preview.classList.add("has-color");
        }
        
        if (selectedColorIndices.length >= 2 && currentPaletteData[selectedColorIndices[1]]) {
            const index2 = selectedColorIndices[1];
            const color2 = currentPaletteData[index2].color;
            const [r2, g2, b2] = color2;
            const hex2 = rgbToHex(r2, g2, b2);
            const textColor2 = isLightColor(r2, g2, b2) ? "#000000" : "#FFFFFF";
            
            if (placeholder2) placeholder2.style.display = "none";
            const div2 = document.createElement("div");
            div2.className = "swap-preview-color";
            div2.style.backgroundColor = hex2;
            div2.style.color = textColor2;
            
            // Create HEX value display
            const hexSpan2 = document.createElement("div");
            hexSpan2.className = "swap-preview-hex";
            hexSpan2.textContent = hex2.toUpperCase();
            hexSpan2.style.color = textColor2;
            
            // Create percentage display
            const percentSpan2 = document.createElement("div");
            percentSpan2.className = "swap-preview-percentage";
            percentSpan2.textContent = `${currentPaletteData[index2].percentage.toFixed(1)}%`;
            percentSpan2.style.color = textColor2;
            
            div2.appendChild(hexSpan2);
            div2.appendChild(percentSpan2);
            color2Preview.appendChild(div2);
            color2Preview.classList.add("has-color");
            swapPreviewContainer.classList.add("has-colors");
        }
    }

    // Render color palette with selection state
    function renderColorPalette() {
        colorBar.innerHTML = "";
        
        currentPaletteData.forEach((item, index) => {
            const [r, g, b] = item.color;
            const percentage = item.percentage;
            const hexColor = rgbToHex(r, g, b);
            const textColor = isLightColor(r, g, b) ? "#000000" : "#FFFFFF";
            const isSelected = selectedColorIndices.includes(index);
            const selectionIndex = selectedColorIndices.indexOf(index); // 0 for Color 1, 1 for Color 2, -1 if not selected
            
            const segment = document.createElement("div");
            segment.className = "color-segment" + (isSelected ? " selected" : "");
            segment.style.backgroundColor = hexColor;
            segment.style.color = textColor;
            segment.style.width = `${percentage}%`;
            segment.style.minWidth = percentage > 0 ? "50px" : "0";
            segment.textContent = `${percentage.toFixed(1)}%`;
            segment.title = `RGB(${r}, ${g}, ${b}) - ${hexColor}`;
            segment.dataset.colorIndex = index;
            
            // Add color label if selected
            if (isSelected && selectionIndex >= 0) {
                const label = document.createElement("div");
                label.className = "color-label";
                label.textContent = `Color ${selectionIndex + 1}`;
                segment.appendChild(label);
            }
            
            // Add click handler for color selection
            segment.addEventListener("click", () => {
                const colorIndex = parseInt(segment.dataset.colorIndex);
                
                if (selectedColorIndices.includes(colorIndex)) {
                    // Deselect if already selected
                    selectedColorIndices = selectedColorIndices.filter(idx => idx !== colorIndex);
                } else {
                    // Select if not already selected (max 2)
                    if (selectedColorIndices.length < 2) {
                        selectedColorIndices.push(colorIndex);
                    }
                }
                
                renderColorPalette();
                updateSwapButtonState();
                updatePreviewBoxes();
            });
            
            colorBar.appendChild(segment);
        });
    }

    // Simple color quantization using median cut algorithm
    function quantizeColors(pixels, colorCount) {
        // Create color buckets
        const buckets = [pixels];
        const finalColors = [];

        // Split buckets until we have enough colors
        while (buckets.length < colorCount && buckets.length > 0) {
            const bucket = buckets.shift();
            if (bucket.length === 0) continue;

            // Find the color channel with the greatest range
            let rMin = 255, rMax = 0;
            let gMin = 255, gMax = 0;
            let bMin = 255, bMax = 0;

            bucket.forEach(pixel => {
                const [r, g, b] = pixel;
                rMin = Math.min(rMin, r);
                rMax = Math.max(rMax, r);
                gMin = Math.min(gMin, g);
                gMax = Math.max(gMax, g);
                bMin = Math.min(bMin, b);
                bMax = Math.max(bMax, b);
            });

            const rRange = rMax - rMin;
            const gRange = gMax - gMin;
            const bRange = bMax - bMin;

            // Sort by the channel with the greatest range
            let sortChannel = 0; // 0 = R, 1 = G, 2 = B
            if (gRange > rRange && gRange > bRange) {
                sortChannel = 1;
            } else if (bRange > rRange) {
                sortChannel = 2;
            }

            bucket.sort((a, b) => a[sortChannel] - b[sortChannel]);

            // Split at median
            const median = Math.floor(bucket.length / 2);
            buckets.push(bucket.slice(0, median));
            buckets.push(bucket.slice(median));
        }

        // Calculate average color for each bucket
        buckets.forEach(bucket => {
            if (bucket.length === 0) return;

            let rSum = 0, gSum = 0, bSum = 0;
            bucket.forEach(pixel => {
                rSum += pixel[0];
                gSum += pixel[1];
                bSum += pixel[2];
            });

            finalColors.push([
                Math.round(rSum / bucket.length),
                Math.round(gSum / bucket.length),
                Math.round(bSum / bucket.length)
            ]);
        });

        // If we don't have enough colors, fill with additional colors from the image
        if (finalColors.length < colorCount) {
            const allPixels = [];
            for (let i = 0; i < pixels.length; i += 100) { // Sample every 100th pixel
                allPixels.push(pixels[i]);
            }
            
            // Use k-means clustering for remaining colors
            const remaining = colorCount - finalColors.length;
            for (let i = 0; i < remaining && allPixels.length > 0; i++) {
                const randomIndex = Math.floor(Math.random() * allPixels.length);
                finalColors.push(allPixels[randomIndex]);
            }
        }

        return finalColors.slice(0, colorCount);
    }

    // Extract dominant colors from image using canvas
    async function extractDominantColors(image, colorCount = 5) {
        return new Promise((resolve) => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            
            // Resize image for faster processing (max 200px on longest side)
            const maxSize = 200;
            let width = image.naturalWidth;
            let height = image.naturalHeight;
            
            if (width > height) {
                if (width > maxSize) {
                    height = (height / width) * maxSize;
                    width = maxSize;
                }
            } else {
                if (height > maxSize) {
                    width = (width / height) * maxSize;
                    height = maxSize;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(image, 0, 0, width, height);
            
            const imageData = ctx.getImageData(0, 0, width, height);
            const pixels = imageData.data;
            const pixelArray = [];
            
            // Extract pixel colors (sample every 4th pixel for performance)
            for (let i = 0; i < pixels.length; i += 16) { // Every 4th pixel (RGBA = 4 bytes)
                const r = pixels[i];
                const g = pixels[i + 1];
                const b = pixels[i + 2];
                const a = pixels[i + 3];
                
                // Skip transparent pixels
                if (a > 128) {
                    pixelArray.push([r, g, b]);
                }
            }
            
            // Quantize colors
            const dominantColors = quantizeColors(pixelArray, colorCount);
            resolve(dominantColors);
        });
    }

    // Handle file picker button click
    filePickerButton.addEventListener("click", () => {
        imageUpload.click();
    });

    // Handle file upload
    imageUpload.addEventListener("change", async (event) => {
        console.log("File selected");
        const file = event.target.files[0];
        if (!file || !file.type.startsWith("image/")) {
            console.log("Invalid file type");
            filePickerButton.textContent = "Choose File";
            return;
        }

        // Update button text
        filePickerButton.textContent = file.name.length > 25 ? file.name.substring(0, 22) + "..." : file.name;

        // Show loading state
        colorBar.innerHTML = "<div style='padding: 16px; text-align: center;'>Processing image...</div>";

        const reader = new FileReader();
        reader.onload = async (e) => {
            const img = new Image();
            
            // ColorThief needs the image to be in the DOM or have crossOrigin set
            // We'll add it temporarily and hide it
            img.style.display = "none";
            img.style.position = "absolute";
            img.style.visibility = "hidden";
            document.body.appendChild(img);
            
            img.onload = async () => {
                try {
                    console.log("Image loaded, extracting colors...");
                    console.log("Image dimensions:", img.naturalWidth, "x", img.naturalHeight);
                    
                    // Extract dominant colors using our custom algorithm
                    const palette = await extractDominantColors(img, 5);
                    console.log("Palette extracted:", palette);
                    
                    if (!palette || palette.length === 0) {
                        throw new Error("Failed to extract palette");
                    }
                    
                    // Calculate color percentages
                    const percentages = await calculateColorPercentages(img, palette);
                    console.log("Percentages calculated:", percentages);
                    
                    // Store current image and create canvas for pixel swapping
                    currentImage = img;
                    currentCanvas = document.createElement("canvas");
                    const ctx = currentCanvas.getContext("2d");
                    currentCanvas.width = img.naturalWidth;
                    currentCanvas.height = img.naturalHeight;
                    ctx.drawImage(img, 0, 0);
                    currentImageData = ctx.getImageData(0, 0, currentCanvas.width, currentCanvas.height);
                    
                    // Store palette data
                    currentPaletteData = palette.map((color, index) => ({
                        color: color,
                        percentage: percentages[index]
                    }));
                    
                    // Reset selection
                    selectedColorIndices = [];
                    updatePreviewBoxes();
                    
                    // Keep image in DOM for preview (make it visible)
                    img.style.display = "block";
                    img.style.position = "static";
                    img.style.visibility = "visible";
                    img.style.maxWidth = "100%";
                    img.style.height = "auto";
                    img.style.marginTop = "16px";
                    img.style.borderRadius = "4px";
                    img.id = "imagePreview";
                    
                    // Remove old preview if exists
                    const oldPreview = document.getElementById("imagePreview");
                    if (oldPreview && oldPreview !== img) {
                        document.body.removeChild(oldPreview);
                    }
                    
                    // Add preview after color bar
                    if (!img.parentNode) {
                        colorBar.parentNode.insertBefore(img, colorBar.nextSibling);
                    }
                    
                    // Render color palette
                    renderColorPalette();
                    updateSwapButtonState();
                } catch (error) {
                    console.error("Error extracting colors:", error);
                    // Remove temporary image if still in DOM
                    if (img.parentNode) {
                        document.body.removeChild(img);
                    }
                    colorBar.innerHTML = `<div style='padding: 16px; color: red;'>Error: ${error.message}. Please try another image.</div>`;
                }
            };
            
            img.onerror = (error) => {
                console.error("Image load error:", error);
                if (img.parentNode) {
                    document.body.removeChild(img);
                }
                colorBar.innerHTML = "<div style='padding: 16px; color: red;'>Failed to load image. Please try another image.</div>";
            };
            
            img.src = e.target.result;
        };
        
        reader.onerror = (error) => {
            console.error("FileReader error:", error);
            colorBar.innerHTML = "<div style='padding: 16px; color: red;'>Failed to read file. Please try another image.</div>";
        };
        
        reader.readAsDataURL(file);
    });

    // Handle import button click
    importButton.addEventListener("click", async () => {
        try {
            // Check if we have a processed image (with potential swaps)
            if (currentCanvas) {
                // Use the swapped/modified canvas if available
                currentCanvas.toBlob(async (blob) => {
                    if (blob) {
                        await addOnUISdk.app.document.addImage(blob);
                        console.log("Image (with swaps) successfully imported to the document.");
                    }
                }, "image/png");
                return;
            }
            
            // Fallback to original file if no canvas available
            if (!imageUpload.files || imageUpload.files.length === 0) {
                alert("Please select an image file first.");
                return;
            }

            const file = imageUpload.files[0];
            
            // Validate file type
            if (!file.type.startsWith("image/")) {
                alert("Please select a valid image file.");
                return;
            }

            // Convert file to Blob
            const blob = new Blob([file], { type: file.type });
            
            // Add image to the document using Adobe Express SDK
            await addOnUISdk.app.document.addImage(blob);
            
            console.log("Image successfully imported to the document.");
        } catch (error) {
            console.error("Error importing image:", error);
            alert(`Failed to import image: ${error.message || "Unknown error"}`);
        }
    });

    // Swap colors in image pixels
    function swapImagePixels(colorA, colorB, threshold = 30) {
        if (!currentCanvas || !currentImageData) {
            console.error("No image data available for swapping");
            return;
        }

        const ctx = currentCanvas.getContext("2d");
        // Create a copy of image data to modify
        const pixels = new Uint8ClampedArray(currentImageData.data);
        
        // Swap pixels that are close to colorA or colorB
        for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            const pixelRgb = [r, g, b];
            
            const distToA = colorDistance(pixelRgb, colorA);
            const distToB = colorDistance(pixelRgb, colorB);
            
            if (distToA <= threshold) {
                // Pixel is close to colorA, swap to colorB
                pixels[i] = colorB[0];
                pixels[i + 1] = colorB[1];
                pixels[i + 2] = colorB[2];
            } else if (distToB <= threshold) {
                // Pixel is close to colorB, swap to colorA
                pixels[i] = colorA[0];
                pixels[i + 1] = colorA[1];
                pixels[i + 2] = colorA[2];
            }
        }
        
        // Create new ImageData with modified pixels
        const newImageData = new ImageData(pixels, currentCanvas.width, currentCanvas.height);
        
        // Put the modified image data back to canvas
        ctx.putImageData(newImageData, 0, 0);
        
        // Update currentImageData reference
        currentImageData = newImageData;
        
        // Update the image source and wait for it to load
        return new Promise((resolve) => {
            currentImage.onload = () => {
                resolve();
            };
            currentImage.src = currentCanvas.toDataURL();
        });
    }

    // Handle swap button click
    swapButton.addEventListener("click", async () => {
        if (selectedColorIndices.length !== 2) {
            return;
        }

        const [indexA, indexB] = selectedColorIndices;
        
        // Prevent swapping the same color with itself
        if (indexA === indexB) {
            return;
        }

        const colorA = currentPaletteData[indexA].color;
        const colorB = currentPaletteData[indexB].color;

        // Swap colors in palette data
        const tempColor = currentPaletteData[indexA].color;
        const tempPercentage = currentPaletteData[indexA].percentage;
        currentPaletteData[indexA].color = currentPaletteData[indexB].color;
        currentPaletteData[indexA].percentage = currentPaletteData[indexB].percentage;
        currentPaletteData[indexB].color = tempColor;
        currentPaletteData[indexB].percentage = tempPercentage;

        // Swap pixels in image
        await swapImagePixels(colorA, colorB);

        // Recalculate percentages after swap to ensure accuracy
        if (currentImage && currentImage.complete) {
            const newPercentages = await calculateColorPercentages(currentImage, currentPaletteData.map(item => item.color));
            currentPaletteData.forEach((item, index) => {
                item.percentage = newPercentages[index];
            });
        }

        // Clear selection
        selectedColorIndices = [];

        // Re-render palette
        renderColorPalette();
        updateSwapButtonState();
        updatePreviewBoxes();
    });
});
