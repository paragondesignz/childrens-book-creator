import PDFDocument from 'pdfkit';
import { db } from '@/lib/db';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-southeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

export class PdfGenerationService {
  async generatePdf(bookOrderId: string): Promise<void> {
    try {
      // Update status
      await db.bookOrder.update({
        where: { id: bookOrderId },
        data: { status: 'creating-pdf' },
      });

      // Get all book data
      const bookOrder = await db.bookOrder.findUnique({
        where: { id: bookOrderId },
        include: {
          generatedStory: {
            include: {
              storyPages: {
                orderBy: { pageNumber: 'asc' },
              },
            },
          },
          generatedImages: {
            orderBy: { pageNumber: 'asc' },
          },
        },
      });

      if (!bookOrder || !bookOrder.generatedStory) {
        throw new Error('Book order or story not found');
      }

      console.log('Generating PDF...');

      // Create PDF
      const pdfBuffer = await this.createPdfBuffer(bookOrder);

      // Upload to S3
      const pdfKey = `${bookOrderId}/book.pdf`;
      await s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET_PDFS || '',
          Key: pdfKey,
          Body: pdfBuffer,
          ContentType: 'application/pdf',
        })
      );

      const pdfUrl = `https://${process.env.AWS_S3_BUCKET_PDFS}.s3.${process.env.AWS_REGION}.amazonaws.com/${pdfKey}`;

      // Save to database
      await db.generatedPdf.create({
        data: {
          bookOrderId,
          pdfUrl,
          fileSizeBytes: pdfBuffer.length,
          pageCount: bookOrder.generatedStory.storyPages.length + 2, // +2 for cover and back
        },
      });

      // Update book order status
      await db.bookOrder.update({
        where: { id: bookOrderId },
        data: {
          status: 'completed',
          processingCompletedAt: new Date(),
        },
      });

      console.log('PDF generated successfully');
    } catch (error) {
      console.error('PDF generation error:', error);
      await db.bookOrder.update({
        where: { id: bookOrderId },
        data: {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  }

  private async createPdfBuffer(bookOrder: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: [612, 792], // 8.5" x 11" in points
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title: bookOrder.generatedStory.title,
          Author: `Created for ${bookOrder.childFirstName}`,
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
        this.addCoverPage(doc, bookOrder);

        // Story pages
        bookOrder.generatedStory.storyPages.forEach((page: any, index: number) => {
          doc.addPage();
          this.addStoryPage(doc, page, bookOrder.generatedImages[index]);
        });

        // Back cover
        doc.addPage();
        this.addBackCover(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  private addCoverPage(doc: PDFKit.PDFDocument, bookOrder: any): void {
    doc.fontSize(32)
      .font('Helvetica-Bold')
      .text(bookOrder.generatedStory.title, 100, 200, {
        align: 'center',
        width: 412,
      });

    doc.fontSize(18)
      .font('Helvetica')
      .text(`A Story About ${bookOrder.childFirstName}`, 100, 300, {
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
    // Add page number
    doc.fontSize(10)
      .font('Helvetica')
      .text(`${page.pageNumber}`, 50, 750, {
        align: 'center',
        width: 512,
      });

    // Add text
    doc.fontSize(14)
      .font('Helvetica')
      .text(page.pageText, 100, 100, {
        align: 'left',
        width: 412,
      });

    // Note: In a real implementation, we would add the actual image here
    // For now, we'll add a placeholder
    doc.fontSize(10)
      .fillColor('#cccccc')
      .text('[Illustration would appear here]', 100, 400, {
        align: 'center',
        width: 412,
      });
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

export const pdfGenerationService = new PdfGenerationService();
