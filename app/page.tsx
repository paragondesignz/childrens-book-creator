import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl font-bold mb-6">
            Create Magical Stories Starring Your Child
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            AI-generated personalized illustrated storybooks that make your child the hero of their own adventure
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/create"
              className="bg-primary text-primary-foreground px-8 py-3 rounded-lg font-semibold hover:opacity-90 transition"
            >
              Create Your Story
            </Link>
            <Link
              href="/templates"
              className="bg-secondary text-secondary-foreground px-8 py-3 rounded-lg font-semibold hover:opacity-90 transition"
            >
              View Templates
            </Link>
          </div>
        </div>

        <div className="mt-24 grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="text-4xl mb-4">📸</div>
            <h3 className="text-xl font-semibold mb-2">Upload Photo</h3>
            <p className="text-muted-foreground">
              Upload a photo of your child to create a personalized character
            </p>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-4">✨</div>
            <h3 className="text-xl font-semibold mb-2">AI Creates Magic</h3>
            <p className="text-muted-foreground">
              Our AI generates a unique 15-page illustrated story featuring your child
            </p>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-4">📚</div>
            <h3 className="text-xl font-semibold mb-2">Download or Print</h3>
            <p className="text-muted-foreground">
              Get a digital PDF or order a beautifully printed book
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
