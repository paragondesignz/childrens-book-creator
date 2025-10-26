import PDFDocument from 'pdfkit';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface GeneratePDFParams {
  bookOrderId: string;
  storyId: string;
  title: string;
  pages: any[];
  images: any[];
}

export class PDFGenerationService {
  async generatePDF(params: GeneratePDFParams): Promise<any> {
    const { bookOrderId, storyId, title, pages, images } = params;

    try {
      console.log('Generating PDF...');

      // Fetch story pages from database
      const { data: storyPages, error: pagesError } = await supabase
        .from('story_pages')
        .select('*')
        .eq('story_id', storyId)
        .order('page_number', { ascending: true });

      if (pagesError || !storyPages) {
        throw new Error('Failed to fetch story pages');
      }

      // Fetch generated images
      const { data: generatedImages, error: imagesError } = await supabase
        .from('generated_images')
        .select('*')
        .eq('book_order_id', bookOrderId)
        .order('page_number', { ascending: true });

      if (imagesError) {
        throw new Error('Failed to fetch images');
      }

      // Create PDF buffer
      const pdfBuffer = await this.createPDFBuffer({
        title,
        pages: storyPages,
        images: generatedImages || [],
        bookOrderId,
      });

      // Upload to Supabase Storage
      const filePath = `${bookOrderId}/book.pdf`;

      const { error: uploadError } = await supabase.storage
        .from('generated-pdfs')
        .upload(filePath, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Failed to upload PDF: ${uploadError.message}`);
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('generated-pdfs')
        .getPublicUrl(filePath);

      // Save to database
      const { data: generatedPdf, error: dbError } = await supabase
        .from('generated_pdfs')
        .insert({
          book_order_id: bookOrderId,
          pdf_url: publicUrl, // Correct field name
          file_size_bytes: pdfBuffer.length,
          page_count: storyPages.length + 2, // +2 for cover and back cover
        })
        .select()
        .single();

      if (dbError) {
        throw new Error('Failed to save PDF to database');
      }

      console.log('PDF generated successfully');
      return generatedPdf;
    } catch (error) {
      console.error('PDF generation error:', error);
      throw error;
    }
  }

  private async createPDFBuffer(data: {
    title: string;
    pages: any[];
    images: any[];
    bookOrderId: string;
  }): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      const doc = new PDFDocument({
        size: [612, 792], // 8.5" x 11" in points
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title: data.title,
          Author: 'Personalized Children\'s Storybooks',
          Creator: 'Personalized Children\'s Storybooks',
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);

      try {
        // Cover page
        this.addCoverPage(doc, data.title);

        // Story pages - fetch images and add them
        for (let i = 0; i < data.pages.length; i++) {
          const page = data.pages[i];
          const image = data.images.find((img: any) => img.page_number === page.page_number);

          doc.addPage();

          // If we have an image, try to fetch and add it
          if (image?.image_url) {
            try {
              const response = await axios.get(image.image_url, { responseType: 'arraybuffer' });
              const imageBuffer = Buffer.from(response.data);

              // Add image
              doc.image(imageBuffer, 100, 100, {
                width: 412,
                height: 300,
                align: 'center',
              });

              // Add text below image
              doc.moveDown(20);
              doc.fontSize(12)
                .font('Helvetica')
                .text(page.page_text, 100, 420, {
                  align: 'left',
                  width: 412,
                });
            } catch (imgError) {
              console.error(`Failed to load image for page ${page.page_number}:`, imgError);
              // Fall back to text-only layout
              this.addStoryPage(doc, page, null);
            }
          } else {
            this.addStoryPage(doc, page, null);
          }

          // Add page number
          doc.fontSize(10)
            .font('Helvetica')
            .text(`${page.page_number}`, 50, 750, {
              align: 'center',
              width: 512,
            });
        }

        // Back cover
        doc.addPage();
        this.addBackCover(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  private addCoverPage(doc: PDFKit.PDFDocument, title: string): void {
    doc.fontSize(32)
      .font('Helvetica-Bold')
      .text(title, 100, 200, {
        align: 'center',
        width: 412,
      });

    doc.fontSize(18)
      .font('Helvetica')
      .text('A Personalized Story', 100, 300, {
        align: 'center',
        width: 412,
      });

    doc.fontSize(12)
      .text(`Created ${new Date().toLocaleDateString()}`, 100, 700, {
        align: 'center',
        width: 412,
      });
  }

  private addStoryPage(
    doc: PDFKit.PDFDocument,
    page: any,
    image: any
  ): void {
    // Add text
    doc.fontSize(14)
      .font('Helvetica')
      .text(page.page_text, 100, 100, {
        align: 'left',
        width: 412,
      });

    // Placeholder for illustration
    doc.fontSize(10)
      .fillColor('#cccccc')
      .text('[Illustration]', 100, 400, {
        align: 'center',
        width: 412,
      })
      .fillColor('#000000'); // Reset color
  }

  private addBackCover(doc: PDFKit.PDFDocument): void {
    doc.fontSize(14)
      .font('Helvetica')
      .text('Created with Personalized Children\'s Storybooks', 100, 350, {
        align: 'center',
        width: 412,
      });

    doc.fontSize(10)
      .text('© ' + new Date().getFullYear() + ' All rights reserved', 100, 400, {
        align: 'center',
        width: 412,
      });
  }
}

export const pdfGenerationService = new PDFGenerationService();
