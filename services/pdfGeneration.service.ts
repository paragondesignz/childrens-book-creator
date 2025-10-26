import PDFDocument from 'pdfkit';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Lazy initialization to ensure environment variables are loaded
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

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
      const supabase = getSupabase();
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

      // Save to database (upsert in case of retry)
      const { data: generatedPdf, error: dbError } = await supabase
        .from('generated_pdfs')
        .upsert({
          book_order_id: bookOrderId,
          pdf_url: publicUrl, // Correct field name
          file_size_bytes: pdfBuffer.length,
          page_count: (storyPages.length * 2) + 2, // *2 for text+image per story page, +2 for covers
        }, {
          onConflict: 'book_order_id'
        })
        .select()
        .single();

      if (dbError) {
        console.error('Database error details:', JSON.stringify(dbError, null, 2));
        throw new Error(`Failed to save PDF to database: ${dbError.message || JSON.stringify(dbError)}`);
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
        // Front Cover (page_number = 0)
        const frontCover = data.images.find((img: any) => img.page_number === 0);
        if (frontCover?.image_url) {
          await this.addImagePage(doc, frontCover.image_url, 'front cover');
        } else {
          // Fallback to text-only cover
          this.addCoverPage(doc, data.title);
        }

        // Story pages - alternate text and image pages
        // For each story page: Left page = text (Baskerville), Right page = full-bleed image
        for (let i = 0; i < data.pages.length; i++) {
          const page = data.pages[i];
          const image = data.images.find((img: any) => img.page_number === page.page_number);

          // Left page: Text only (white background, Baskerville font)
          doc.addPage();
          this.addTextPage(doc, page);

          // Right page: Full-bleed image
          doc.addPage();
          if (image?.image_url) {
            try {
              const response = await axios.get(image.image_url, { responseType: 'arraybuffer' });
              const imageBuffer = Buffer.from(response.data);

              // Add image as full-bleed (edge to edge)
              const pageWidth = 612;
              const pageHeight = 792;

              doc.image(imageBuffer, 0, 0, {
                width: pageWidth,
                height: pageHeight,
                align: 'center',
                valign: 'center',
              });
            } catch (imgError) {
              console.error(`Failed to load image for page ${page.page_number}:`, imgError);
              // Fallback: show placeholder
              this.addImagePlaceholder(doc, page.page_number);
            }
          } else {
            // No image available, show placeholder
            this.addImagePlaceholder(doc, page.page_number);
          }
        }

        // Back Cover (page_number = 16)
        const backCover = data.images.find((img: any) => img.page_number === 16);
        if (backCover?.image_url) {
          doc.addPage();
          await this.addImagePage(doc, backCover.image_url, 'back cover');
        } else {
          // Fallback to text-only back cover
          doc.addPage();
          this.addBackCover(doc);
        }

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  private async addImagePage(doc: PDFKit.PDFDocument, imageUrl: string, pageType: string): Promise<void> {
    try {
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const imageBuffer = Buffer.from(response.data);

      // Add image as full-bleed (no margins for covers)
      const pageWidth = 612;
      const pageHeight = 792;

      doc.image(imageBuffer, 0, 0, {
        width: pageWidth,
        height: pageHeight,
        align: 'center',
        valign: 'center',
      });

      console.log(`Added ${pageType} image to PDF`);
    } catch (error) {
      console.error(`Failed to load ${pageType} image:`, error);
      throw error;
    }
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

  private addTextPage(doc: PDFKit.PDFDocument, page: any): void {
    // White background with generous margins
    const margin = 80;
    const pageWidth = 612;
    const pageHeight = 792;
    const textWidth = pageWidth - (margin * 2);

    // Use Baskerville font (elegant serif, perfect for children's books)
    // PDFKit includes Times-Roman as fallback if Baskerville not available
    const fontFamily = 'Times-Roman'; // Closest built-in to Baskerville

    // Add story text with comfortable reading size
    doc.fontSize(16)
      .font(fontFamily)
      .fillColor('#000000')
      .text(page.page_text, margin, 150, {
        align: 'left',
        width: textWidth,
        lineGap: 8,
      });

    // Small page number at bottom
    doc.fontSize(10)
      .fillColor('#999999')
      .text(`${page.page_number}`, margin, pageHeight - 40, {
        align: 'center',
        width: textWidth,
      });
  }

  private addImagePlaceholder(doc: PDFKit.PDFDocument, pageNumber: number): void {
    // Simple placeholder for missing images
    const pageWidth = 612;
    const pageHeight = 792;

    doc.fontSize(14)
      .font('Helvetica')
      .fillColor('#cccccc')
      .text(`[Image ${pageNumber}]`, 0, pageHeight / 2 - 20, {
        align: 'center',
        width: pageWidth,
      })
      .fillColor('#000000');
  }

  private addStoryPage(
    doc: PDFKit.PDFDocument,
    page: any,
    image: any
  ): void {
    // Legacy fallback - not used in new alternating layout
    doc.fontSize(14)
      .font('Helvetica')
      .text(page.page_text, 100, 100, {
        align: 'left',
        width: 412,
      });

    doc.fontSize(10)
      .fillColor('#cccccc')
      .text('[Illustration]', 100, 400, {
        align: 'center',
        width: 412,
      })
      .fillColor('#000000');
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
