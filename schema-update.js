import fs from 'fs';

let serverTs = fs.readFileSync('server.ts', 'utf8');

const schemaString = `
          responseSchema: {
            type: "OBJECT",
            properties: {
              product: {
                type: "OBJECT",
                properties: {
                  name: { type: "STRING", nullable: true },
                  brand: { type: "STRING", nullable: true },
                  commodity_type: { type: "STRING", nullable: true },
                  medical_device: { type: "STRING", enum: ["TRUE", "FALSE", "UNKNOWN"] }
                }
              },
              coverage: {
                type: "OBJECT",
                properties: {
                  package_sides_visible: { type: "ARRAY", items: { type: "STRING" } },
                  mandatory_declaration_panel_visible: { type: "STRING", enum: ["YES", "NO", "UNCERTAIN"] },
                  coverage_notes: { type: "ARRAY", items: { type: "STRING" } }
                }
              },
              fields: {
                type: "OBJECT",
                properties: {
                  mrp: { type: "ARRAY", items: { type: "OBJECT", properties: { value: { type: "STRING" }, qualifier: { type: "STRING", nullable: true }, confidence: { type: "NUMBER" }, evidence: { type: "STRING" }, image_index: { type: "INTEGER" } } } },
                  net_quantity: { type: "ARRAY", items: { type: "OBJECT", properties: { value: { type: "STRING" }, qualifier: { type: "STRING", nullable: true }, confidence: { type: "NUMBER" }, evidence: { type: "STRING" }, image_index: { type: "INTEGER" } } } },
                  responsible_entity: { type: "ARRAY", items: { type: "OBJECT", properties: { value: { type: "STRING" }, qualifier: { type: "STRING", nullable: true }, confidence: { type: "NUMBER" }, evidence: { type: "STRING" }, image_index: { type: "INTEGER" } } } },
                  address: { type: "ARRAY", items: { type: "OBJECT", properties: { value: { type: "STRING" }, qualifier: { type: "STRING", nullable: true }, confidence: { type: "NUMBER" }, evidence: { type: "STRING" }, image_index: { type: "INTEGER" } } } },
                  date: { type: "ARRAY", items: { type: "OBJECT", properties: { value: { type: "STRING" }, qualifier: { type: "STRING", nullable: true }, confidence: { type: "NUMBER" }, evidence: { type: "STRING" }, image_index: { type: "INTEGER" } } } },
                  consumer_care: { type: "ARRAY", items: { type: "OBJECT", properties: { value: { type: "STRING" }, qualifier: { type: "STRING", nullable: true }, confidence: { type: "NUMBER" }, evidence: { type: "STRING" }, image_index: { type: "INTEGER" } } } }
                }
              },
              visual: {
                type: "OBJECT",
                properties: {
                  overall_legibility: { type: "STRING", enum: ["CLEAR", "PARTIAL", "POOR", "UNCERTAIN"] },
                  contrast: { type: "STRING", enum: ["ADEQUATE", "LOW", "UNCERTAIN"] },
                  principal_display_panel_visible: { type: "STRING", enum: ["YES", "NO", "UNCERTAIN"] },
                  exact_font_size_verifiable: { type: "BOOLEAN" },
                  notes: { type: "ARRAY", items: { type: "STRING" } }
                }
              },
              raw_text_by_image: {
                type: "ARRAY",
                items: { type: "OBJECT", properties: { image_index: { type: "INTEGER" }, text: { type: "STRING" } } }
              }
            },
            required: ["product", "coverage", "fields", "visual", "raw_text_by_image"]
          }`;

serverTs = serverTs.replace(/generationConfig:\s*\{\s*temperature:\s*0\.1,\s*responseMimeType:\s*"application\/json",\s*maxOutputTokens:\s*4096,?\s*\}/, 
  `generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
          maxOutputTokens: 4096,${schemaString}
        }`);

// Also fix the prompt to be pure instructions now that schema handles the shape
serverTs = serverTs.replace(/Return ONE valid JSON object, with no markdown fences, using this exact shape:[\s\S]*?raw_text_by_image": \[\{"image_index": integer, "text": string\}\]\n\}/, 
  'Extract the details carefully based on the provided schema.');

fs.writeFileSync('server.ts', serverTs);
console.log("Schema injected.");
