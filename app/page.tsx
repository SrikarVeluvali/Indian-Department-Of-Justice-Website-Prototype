'use client';

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MessageCircle, FileText, Scale, Video, User, Menu, Globe, Upload, Phone, Mail } from 'lucide-react'
import { Groq } from "groq-sdk"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

let groq: Groq | null = null;

if (typeof window !== 'undefined') {
  groq = new Groq({
    apiKey: process.env.NEXT_PUBLIC_GROQ_API_KEY,
    dangerouslyAllowBrowser: true
  });
}

async function getGroqChatCompletion(messages: Array<{ role: string; content: string }>) {
  if (!groq) {
    throw new Error("Groq client is not initialized");
  }

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: messages,
      model: "llama3-8b-8192",
      max_tokens: 1000,
      temperature: 0.5,
      top_p: 1,
      stream: false,
    });
    return chatCompletion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";
  } catch (error) {
    console.error("Error calling Groq API:", error);
    throw error;
  }
}

async function getGroqVisionAnalysis(imageUrl: string) {
  if (!groq) {
    throw new Error("Groq client is not initialized");
  }

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze this legal document and provide a detailed report." },
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
      model: "llava-v1.5-7b-4096-preview",
    });
    return chatCompletion.choices[0]?.message?.content || "I'm sorry, I couldn't analyze the document.";
  } catch (error) {
    console.error("Error calling Groq Vision API:", error);
    throw error;
  }
}

async function translateText(text: string, targetLang: string) {
  const sourceLang = 'en';
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    if (data.responseStatus !== 200) {
      throw new Error(`Translation API error: ${data.responseStatus}`);
    }
    return data.responseData.translatedText;
  } catch (error) {
    console.error("Translation error:", error);
    throw error;
  }
}

interface Message {
  role: string;
  content: string;
  translatedContent?: string;
}

interface Lawyer {
  name: string;
  specialization: string;
  phone: string;
  email: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hello! How can I assist you with the Indian Department of Justice today?' }
  ])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState('en')
  const [documentAnalysis, setDocumentAnalysis] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [lawyers, setLawyers] = useState<Lawyer[]>([])
  const [showLawyers, setShowLawyers] = useState(false)

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputMessage.trim() || isLoading) return

    const userMessage = { role: 'user', content: inputMessage }
    setMessages(prevMessages => [...prevMessages, userMessage])
    setInputMessage('')
    setIsLoading(true)
    setError(null)

    try {
      const aiResponse = await getGroqChatCompletion([...messages, userMessage])
      const botMessage = { role: 'assistant', content: aiResponse }
      setMessages(prevMessages => [...prevMessages, botMessage])
    } catch (error) {
      console.error("Error getting AI response:", error)
      setError("An error occurred while getting the AI response. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleTranslateMessage = async (index: number) => {
    if (selectedLanguage === 'en') return;

    const messageToTranslate = messages[index];
    if (messageToTranslate.translatedContent) {
      const updatedMessages = [...messages];
      [updatedMessages[index].content, updatedMessages[index].translatedContent] = 
        [updatedMessages[index].translatedContent!, updatedMessages[index].content];
      setMessages(updatedMessages);
    } else {
      try {
        const translatedContent = await translateText(messageToTranslate.content, selectedLanguage);
        const updatedMessages = [...messages];
        updatedMessages[index] = {
          ...messageToTranslate,
          translatedContent: messageToTranslate.content,
          content: translatedContent
        };
        setMessages(updatedMessages);
      } catch (error) {
        console.error("Translation error:", error);
        setError("Failed to translate the message. Please try again.");
      }
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const imageUrl = await uploadImage(file);
      const analysis = await getGroqVisionAnalysis(imageUrl);
      setDocumentAnalysis(analysis);
    } catch (error) {
      console.error("Error analyzing document:", error);
      setError("An error occurred while analyzing the document. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const uploadImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const data = await response.json();
      return data.url;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  };

  const handleSearchLawyers = () => {
    const dummyLawyers: Lawyer[] = [
      {
        name: "Adv. Priya Sharma",
        specialization: "Criminal Law",
        phone: "+91 98765 43210",
        email: "priya.sharma@legaleagle.com"
      },
      {
        name: "Adv. Rajesh Patel",
        specialization: "Corporate Law",
        phone: "+91 87654 32109",
        email: "rajesh.patel@legalminds.com"
      },
      {
        name: "Adv. Anita Desai",
        specialization: "Family Law",
        phone: "+91 76543 21098",
        email: "anita.desai@familymatters.com"
      }
    ];
    setLawyers(dummyLawyers);
    setShowLawyers(true);
  };

  useEffect(() => {
    const chatContainer = document.getElementById('chat-container')
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight
    }
  }, [messages])

  return (
    <div className="min-h-screen bg-white text-black">
      <header className="bg-black text-white p-4 sticky top-0 z-10">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Indian Department of Justice</h1>
          <nav className="hidden md:block">
            <ul className="flex space-x-6">
              <li><a href="#" className="hover:text-gray-300 transition-colors">Home</a></li>
              <li><a href="#" className="hover:text-gray-300 transition-colors">About</a></li>
              <li><a href="#" className="hover:text-gray-300 transition-colors">Services</a></li>
              <li><a href="#" className="hover:text-gray-300 transition-colors">Contact</a></li>
            </ul>
          </nav>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            <Menu className="h-6 w-6" />
          </Button>
        </div>
      </header>

      {isMenuOpen && (
        <div className="bg-black text-white p-4 md:hidden">
          <nav>
            <ul className="space-y-2">
              <li><a href="#" className="block py-2 hover:text-gray-300 transition-colors">Home</a></li>
              <li><a href="#" className="block py-2 hover:text-gray-300 transition-colors">About</a></li>
              <li><a href="#" className="block py-2 hover:text-gray-300 transition-colors">Services</a></li>
              <li><a href="#" className="block py-2 hover:text-gray-300 transition-colors">Contact</a></li>
            </ul>
          </nav>
        </div>
      )}

      <main className="container mx-auto mt-8 p-4">
        <Tabs defaultValue="chat" className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-8">
            <TabsTrigger value="chat" className="flex items-center justify-center"><MessageCircle className="mr-2 h-4 w-4" /> Chat</TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center justify-center"><FileText className="mr-2 h-4 w-4" /> Documents</TabsTrigger>
            <TabsTrigger value="forms" className="flex items-center justify-center"><Scale className="mr-2 h-4 w-4" /> Forms</TabsTrigger>
            <TabsTrigger value="livestream" className="flex items-center justify-center"><Video className="mr-2 h-4 w-4" /> Livestream</TabsTrigger>
            <TabsTrigger value="lawyers" className="flex items-center justify-center"><User className="mr-2 h-4 w-4" /> Lawyers</TabsTrigger>
          </TabsList>
          <TabsContent value="chat">
            <Card className="border-2 border-black">
              <CardHeader className="bg-black text-white">
                <CardTitle>DoJ Virtual Assistant</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div id="chat-container" className="h-[400px] overflow-y-auto p-4 bg-gray-100">
                  {messages.map((message, index) => (
                    <div key={index} className={`mb-4 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                      <div className={`inline-block p-3 rounded-lg ${message.role === 'user' ? 'bg-black text-white' : 'bg-white border border-black'}`}>
                        {message.role === 'user' ? (
                          message.content
                        ) : (
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={{
                              h1: ({node, ...props}) => <h1 className="text-2xl font-bold mb-2" {...props} />,
                              h2: ({node, ...props}) => <h2 className="text-xl font-bold mb-2" {...props} />,
                              h3: ({node, ...props}) => <h3 className="text-lg font-bold mb-2" {...props} />,
                              p: ({node, ...props}) => <p className="mb-2" {...props} />,
                              ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-2" {...props} />,
                              ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-2" {...props} />,
                              li: ({node, ...props}) => <li className="mb-1" {...props} />,
                              a: ({node, ...props}) => <a className="text-blue-600 hover:underline" {...props} />,
                              code: ({node, inline, ...props}) => 
                                inline ? (
                                  <code className="bg-gray-200 rounded px-1" {...props} />
                                ) : (
                                  <code className="block bg-gray-200 rounded p-2 mb-2" {...props} />
                                ),
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        )}
                        {message.role === 'assistant' && selectedLanguage !== 'en' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTranslateMessage(index)}
                            className="mt-2"
                          >
                            <Globe className="mr-2 h-4 w-4" />
                            {message.translatedContent ? 'Show Original' : 'Translate'}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="text-center">
                      <span className="inline-block p-2 rounded-lg bg-gray-200">Thinking...</span>
                    </div>
                  )}
                  {error && (
                    <div className="text-center text-red-500">
                      <span className="inline-block p-2 rounded-lg bg-red-100">{error}</span>
                    </div>
                  )}
                </div>
                <form onSubmit={handleSendMessage} className="flex gap-2 p-4 bg-gray-100">
                  <Input
                    type="text"
                    placeholder="Type your message here..."
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    disabled={isLoading}
                    className="flex-grow"
                  />
                  <Button type="submit" disabled={isLoading} className="bg-black text-white hover:bg-gray-800">Send</Button>
                </form>
                <div className="p-4 bg-gray-100">
                  <Select onValueChange={setSelectedLanguage} value={selectedLanguage}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="hi">Hindi</SelectItem>
                      <SelectItem value="bn">Bengali</SelectItem>
                      <SelectItem value="te">Telugu</SelectItem>
                      <SelectItem value="mr">Marathi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="documents">
            <Card className="border-2 border-black">
              <CardHeader className="bg-black text-white">
                <CardTitle>Legal Document Analysis</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <p className="mb-4">Upload an image of your legal document for AI-powered analysis.</p>
                <div className="flex items-center space-x-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    disabled={isAnalyzing}
                    className="flex-grow"
                  />
                  <Button disabled={isAnalyzing} className="bg-black text-white hover:bg-gray-800">
                    <Upload className="mr-2 h-4 w-4" /> Upload
                  </Button>
                </div>
                {isAnalyzing && (
                  <div className="mt-4 text-center">
                    <span className="inline-block p-2 rounded-lg bg-gray-200">Analyzing document...</span>
                  </div>
                )}
                {documentAnalysis && (
                  <div className="mt-4">
                    <h3 className="text-lg font-semibold mb-2">Document Analysis:</h3>
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      className="prose max-w-none"
                    >
                      {documentAnalysis}
                    </ReactMarkdown>
                  </div>
                )}
                {error && (
                  <div className="mt-4 text-center text-red-500">
                    <span className="inline-block p-2 rounded-lg bg-red-100">{error}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="forms">
            <Card className="border-2 border-black">
              <CardHeader className="bg-black text-white">
                <CardTitle>Legal Forms Assistance</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <p className="mb-4">Get help with filling out legal forms.</p>
                <Select>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Form Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="petition">Petition</SelectItem>
                    <SelectItem value="affidavit">Affidavit</SelectItem>
                    <SelectItem value="complaint">Complaint</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="livestream">
            <Card className="border-2 border-black">
              <CardHeader className="bg-black text-white">
                <CardTitle>Livestreaming Court Cases</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <p className="mb-4">Watch live streams of ongoing court cases.</p>
                <Button 
                  className="bg-black text-white hover:bg-gray-800"
                  onClick={() => window.open("https://www.youtube.com/results?search_query=India+Court+cases+live&sp=EgJAAQ%253D%253D", "_blank")}
                >
                  <Video className="mr-2 h-4 w-4" /> View Available Streams
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="lawyers">
            <Card className="border-2 border-black">
              <CardHeader className="bg-black text-white">
                <CardTitle>Find a Certified Lawyer</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <p className="mb-4">Connect with certified lawyers for legal assistance.</p>
                <Button className="bg-black text-white hover:bg-gray-800" onClick={handleSearchLawyers}>
                  <User className="mr-2 h-4 w-4" /> Search Lawyers
                </Button>
                {showLawyers && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-4">Available Lawyers:</h3>
                    <div className="grid gap-4">
                      {lawyers.map((lawyer, index) => (
                        <Card key={index} className="p-4">
                          <h4 className="font-bold">{lawyer.name}</h4>
                          <p className="text-sm text-gray-600">{lawyer.specialization}</p>
                          <div className="flex items-center mt-2">
                            <Phone className="h-4 w-4 mr-2" />
                            <span>{lawyer.phone}</span>
                          </div>
                          <div className="flex items-center mt-1">
                            <Mail className="h-4 w-4 mr-2" />
                            <span>{lawyer.email}</span>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <Card className="border-2 border-black">
            <CardHeader className="bg-black text-white">
              <CardTitle>DoJ Divisions</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <ul className="list-disc pl-5 space-y-2">
                <li>Criminal Division</li>
                <li>Civil Rights Division</li>
                <li>National Security Division</li>
                <li>Environmental and Natural Resources Division</li>
              </ul>
            </CardContent>
          </Card>
          <Card className="border-2 border-black">
            <CardHeader className="bg-black text-white">
              <CardTitle>Judicial Appointments</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="mb-2">Current number of judges:</p>
              <ul className="list-disc pl-5 space-y-2 mb-4">
                <li>Supreme Court: 34</li>
                <li>High Courts: 1,108</li>
                <li>District & Subordinate Courts: 20,993</li>
              </ul>
              <Button className="bg-black text-white hover:bg-gray-800">View Vacancies</Button>
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="bg-black text-white p-6 mt-12">
        <div className="container mx-auto text-center">
          <p>&copy; 2023 Indian Department of Justice. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}