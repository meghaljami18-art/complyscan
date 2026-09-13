export const DEMOS = {
  complete: {
    name: 'Cinthol Talcum Powder — complete declaration panel',
    imagePaths: ['./samples/cinthol-label.jpg'],
    imageNames: ['Dataset image 10.jpg'],
    quality: 'GOOD',
    context: { packageContext: 'RETAIL', medicalDevice: 'FALSE', dateRequired: 'TRUE', commodityType: 'Talcum powder' },
    extraction: {
      product: { name: 'CINTHOL TALCUM POWDER', brand: 'CINTHOL', commodity_type: 'Talcum powder', medical_device: 'FALSE' },
      coverage: { package_sides_visible: ['declaration panel'], mandatory_declaration_panel_visible: 'YES', coverage_notes: ['Dataset-backed extraction prepared from image 10.jpg.'] },
      fields: {
        mrp: [{ value: '₹ 199/-', qualifier: 'Inclusive of all taxes', confidence: 0.96, evidence: '₹ 199/- ₹ 0.66/g', image_index: 0 }],
        net_quantity: [{ value: '300 g', qualifier: 'Net weight', confidence: 0.98, evidence: 'Net weight: 300g', image_index: 0 }],
        responsible_entity: [{ value: 'Progression Industries Pvt. Ltd.', qualifier: 'Manufactured by', confidence: 0.96, evidence: 'Manufactured by: Progression Industries Pvt. Ltd.', image_index: 0 }],
        address: [{ value: 'Unit-II Plot No. 9B, Apparel Park Cum Industrial Area, Village Katha, Baddi, Dist. Solan, Himachal Pradesh – 173205', qualifier: null, confidence: 0.91, evidence: 'Unit-II Plot No. 9B ... Himachal Pradesh - 173205', image_index: 0 }],
        date: [{ value: '04/25', qualifier: 'Packed on', confidence: 0.93, evidence: '# 04/25', image_index: 0 }],
        consumer_care: [{ value: '1-800-266-0007 · care@godrejcp.com', qualifier: 'Consumer feedback', confidence: 0.96, evidence: 'Tel. No.: 1-800-266-0007 E-mail ID: care@godrejcp.com', image_index: 0 }]
      },
      visual: { overall_legibility: 'CLEAR', contrast: 'ADEQUATE', principal_display_panel_visible: 'YES', exact_font_size_verifiable: false, notes: ['Declaration text is readable in the supplied image.', 'Exact legal font height is not measured.'] },
      raw_text_by_image: [{ image_index: 0, text: 'B O-013\n# 04/25\n₹ 199/- ₹ 0.66/g\nCINTHOL TALCUM POWDER\nManufactured by: Progression Industries Pvt. Ltd.\nUnit-II Plot No. 9B, Apparel Park Cum Industrial Area, Village Katha, Baddi, Dist. Solan, Himachal Pradesh - 173205\nNet weight: 300g\nTel. No.: 1-800-266-0007\nE-mail ID: care@godrejcp.com' }]
    }
  },
  coverage: {
    name: 'Zebronics mouse — front view only',
    imagePaths: ['./samples/zebronics-front.jpg'],
    imageNames: ['Dataset image 1.jpg'],
    quality: 'GOOD',
    context: { packageContext: 'RETAIL', medicalDevice: 'FALSE', dateRequired: 'UNKNOWN', commodityType: 'Wireless mouse' },
    extraction: {
      product: { name: 'ZEB-BLANC 10 Wireless Mouse', brand: 'ZEBRONICS', commodity_type: 'Wireless mouse', medical_device: 'FALSE' },
      coverage: { package_sides_visible: ['front'], mandatory_declaration_panel_visible: 'NO', coverage_notes: ['Only the front packaging is visible. Missing declarations must not be treated as confirmed violations.'] },
      fields: { mrp: [], net_quantity: [], responsible_entity: [], address: [], date: [], consumer_care: [] },
      visual: { overall_legibility: 'CLEAR', contrast: 'ADEQUATE', principal_display_panel_visible: 'YES', exact_font_size_verifiable: false, notes: ['Front branding is clear; mandatory declaration panel is not shown.'] },
      raw_text_by_image: [{ image_index: 0, text: 'ZEBRONICS\nWireless Mouse\nZEB-BLANC 10\nDUAL MODE\n2.4GHz + BT\nwww.zebronics.com' }]
    }
  }
};
