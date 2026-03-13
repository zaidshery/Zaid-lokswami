// Types
export interface Category {
  id: string;
  name: string;
  nameEn: string;
  slug: string;
  icon: string;
  color: string;
}

export interface Author {
  id: string;
  name: string;
  avatar: string;
}

export interface Article {
  id: string;
  title: string;
  summary: string;
  content?: string;
  image: string;
  category: string;
  author: Author;
  publishedAt: string;
  readTime?: string;
  views: number;
  isBreaking?: boolean;
  isTrending?: boolean;
}

export interface BreakingNews {
  id: string;
  title: string;
  priority: number;
}

export interface Story {
  id: string;
  title: string;
  caption?: string;
  thumbnail: string;
  mediaType?: 'image' | 'video';
  mediaUrl?: string;
  linkUrl?: string;
  linkLabel?: string;
  category?: string;
  author?: string;
  durationSeconds?: number;
  priority?: number;
  views?: number;
  isPublished?: boolean;
  publishedAt?: string;
  viewed?: boolean;
}

export interface Video {
  id: string;
  title: string;
  thumbnail: string;
  duration: number;
  views: number;
  category: string;
  publishedAt: string;
  isShort?: boolean;
}

export interface VideoCategory {
  id: string;
  name: string;
  nameEn: string;
  slug: string;
}

export interface EpaperEdition {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  pages: EpaperPage[];
}

export interface EpaperPage {
  id: string;
  name: string;
  nameEn: string;
  image: string;
}

// Categories
export const categories: Category[] = [
  { id: '1', name: 'राजनीति', nameEn: 'Politics', slug: 'politics', icon: '🏛️', color: '#E11D2E' },
  { id: '2', name: 'क्षेत्रीय', nameEn: 'Regional', slug: 'regional', icon: '📍', color: '#F59E0B' },
  { id: '3', name: 'राष्ट्रीय', nameEn: 'National', slug: 'national', icon: '🇮🇳', color: '#3B82F6' },
  { id: '4', name: 'अंतर्राष्ट्रीय', nameEn: 'International', slug: 'international', icon: '🌍', color: '#8B5CF6' },
  { id: '5', name: 'खेल', nameEn: 'Sports', slug: 'sports', icon: '🏏', color: '#10B981' },
  { id: '6', name: 'मनोरंजन', nameEn: 'Entertainment', slug: 'entertainment', icon: '🎬', color: '#EC4899' },
  { id: '7', name: 'टेक्नोलॉजी', nameEn: 'Technology', slug: 'technology', icon: '💻', color: '#06B6D4' },
  { id: '8', name: 'व्यापार', nameEn: 'Business', slug: 'business', icon: '💼', color: '#F97316' },
];

// Authors
export const authors: Author[] = [
  { id: '1', name: 'राजेश शर्मा', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop' },
  { id: '2', name: 'सुरेश कुमार', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop' },
  { id: '3', name: 'प्रिया गुप्ता', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop' },
  { id: '4', name: 'अमित तिवारी', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop' },
  { id: '5', name: 'विकास अग्रवाल', avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100&h=100&fit=crop' },
  { id: '6', name: 'नीलम यादव', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop' },
];

// Breaking News
export const breakingNews: BreakingNews[] = [
  { id: '1', title: 'बिहार: बाढ़ से 15 जिले प्रभावित, NDRF की टीमें रवाना', priority: 1 },
  { id: '2', title: 'मुंबई: Local Train Services disrupted due to heavy rains', priority: 2 },
  { id: '3', title: 'IND vs AUS: भारत ने जीता पहला टेस्ट मैच', priority: 3 },
  { id: '4', title: 'Petrol-Diesel Price: आज फिर बढ़े तेल के दाम', priority: 4 },
];

// Stories
export const stories: Story[] = [
  { id: '1', title: 'Breaking News', thumbnail: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=300&h=500&fit=crop' },
  { id: '2', title: 'राजनीति', thumbnail: 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=300&h=500&fit=crop' },
  { id: '3', title: 'खेल', thumbnail: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=300&h=500&fit=crop' },
  { id: '4', title: 'मनोरंजन', thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=500&fit=crop', viewed: true },
  { id: '5', title: 'टेक्नोलॉजी', thumbnail: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=300&h=500&fit=crop' },
  { id: '6', title: 'व्यापार', thumbnail: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=300&h=500&fit=crop', viewed: true },
  { id: '7', title: 'शिक्षा', thumbnail: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=300&h=500&fit=crop' },
  { id: '8', title: 'स्वास्थ्य', thumbnail: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=300&h=500&fit=crop' },
];

// Articles
export const articles: Article[] = [
  {
    id: '1',
    title: 'PM मोदी ने की G20 Summit की अध्यक्षता, विश्व नेताओं ने की शिरकत',
    summary: 'नई दिल्ली में G20 शिखर सम्मेलन का आगाज, भारत की अध्यक्षता में वैश्विक मुद्दों पर होगी चर्चा। विश्व के प्रमुख नेता एक मंच पर आए।',
    image: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=800&h=450&fit=crop',
    category: 'राष्ट्रीय',
    author: authors[0],
    publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    readTime: '5 min read',
    views: 125000,
    isBreaking: true,
    isTrending: true,
  },
  {
    id: '2',
    title: 'IPL 2024: RCB ने CSK को 5 विकेट से हराया, Kohli का शतक',
    summary: 'रॉयल चैलेंजर्स बैंगलोर ने चेन्नई सुपर किंग्स को रोमांचक मुकाबले में हराया। विराट कोहली के शतकीय पारी ने जीत में अहम भूमिका निभाई।',
    image: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=800&h=450&fit=crop',
    category: 'खेल',
    author: authors[1],
    publishedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    readTime: '3 min read',
    views: 89000,
    isTrending: true,
  },
  {
    id: '3',
    title: 'ISRO का नया मिशन: चंद्रयान-4 की तैयारी शुरू',
    summary: 'भारतीय अंतरिक्ष अनुसंधान संगठन ने चंद्रयान-4 मिशन की घोषणा की। यह मिशन चंद्रमा के दक्षिणी ध्रुव पर उतरेगा।',
    image: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=800&h=450&fit=crop',
    category: 'टेक्नोलॉजी',
    author: authors[2],
    publishedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    readTime: '4 min read',
    views: 67000,
    isTrending: true,
  },
  {
    id: '4',
    title: 'बॉलीवुड: Shah Rukh Khan की नई फिल्म का फर्स्ट लुक रिलीज',
    summary: 'किंग खान की आगामी फिल्म का पहला पोस्टर हुआ रिलीज, फैंस हुए एक्साइटेड। सोशल मीडिया पर पोस्टर वायरल।',
    image: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&h=450&fit=crop',
    category: 'मनोरंजन',
    author: authors[3],
    publishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    readTime: '2 min read',
    views: 152000,
    isTrending: true,
  },
  {
    id: '5',
    title: 'Stock Market: Sensex 75,000 के पार, निवेशकों में खुशी',
    summary: 'शेयर बाजार में तेजी जारी, Sensex ने रचा इतिहास। निफ्टी भी नई ऊंचाई पर पहुंचा।',
    image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&h=450&fit=crop',
    category: 'व्यापार',
    author: authors[4],
    publishedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    readTime: '3 min read',
    views: 45000,
  },
  {
    id: '6',
    title: 'Weather Alert: UP-Bihar में भारी बारिश की चेतावनी',
    summary: 'मौसम विभाग ने उत्तर प्रदेश और बिहार में भारी वर्षा की चेतावनी जारी की। NDRF की टीमें अलर्ट पर।',
    image: 'https://images.unsplash.com/photo-1525088553748-01d6e210e00b?w=800&h=450&fit=crop',
    category: 'क्षेत्रीय',
    author: authors[5],
    publishedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    readTime: '2 min read',
    views: 78000,
    isBreaking: true,
  },
  {
    id: '7',
    title: 'USA: Biden ने की Ukraine को मदद की घोषणा',
    summary: 'अमेरिकी राष्ट्रपति जो बाइडेन ने यूक्रेन को सैन्य सहायता का ऐलान किया। NATO देशों ने समर्थन दिया।',
    image: 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&h=450&fit=crop',
    category: 'अंतर्राष्ट्रीय',
    author: authors[0],
    publishedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    readTime: '4 min read',
    views: 34000,
  },
  {
    id: '8',
    title: 'Delhi Metro: नई लाइन का उद्घाटन अगले महीने',
    summary: 'दिल्ली मेट्रो की नई लाइन का उद्घाटन अगले महीने होगा। यह लाइन 15 किलोमीटर लंबी होगी।',
    image: 'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?w=800&h=450&fit=crop',
    category: 'क्षेत्रीय',
    author: authors[2],
    publishedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    readTime: '2 min read',
    views: 56000,
  },
  {
    id: '9',
    title: 'Gold Price: सोना 75,000 के पार, चांदी में भी तेजी',
    summary: 'सोने के दाम 75,000 रुपये प्रति 10 ग्राम के पार पहुंचे। चांदी में भी 2% की तेजी दर्ज।',
    image: 'https://images.unsplash.com/photo-1610375461246-83df859d849d?w=800&h=450&fit=crop',
    category: 'व्यापार',
    author: authors[4],
    publishedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    readTime: '2 min read',
    views: 92000,
    isTrending: true,
  },
  {
    id: '10',
    title: 'iPhone 16: लॉन्च डेट का ऐलान, जानें कीमत',
    summary: 'Apple ने iPhone 16 सीरीज की लॉन्च डेट का ऐलान किया। भारत में कीमत 79,900 रुपये से शुरू।',
    image: 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=800&h=450&fit=crop',
    category: 'टेक्नोलॉजी',
    author: authors[1],
    publishedAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
    readTime: '3 min read',
    views: 134000,
    isTrending: true,
  },
];

// Videos
export const videos: Video[] = [
  {
    id: 'v1',
    title: 'G20 Summit: PM Modi का भाषण',
    thumbnail: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=600&h=340&fit=crop',
    duration: 330,
    views: 1200000,
    category: 'राष्ट्रीय',
    publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'v2',
    title: 'IPL Highlights: RCB vs CSK',
    thumbnail: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=600&h=340&fit=crop',
    duration: 225,
    views: 850000,
    category: 'खेल',
    publishedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'v3',
    title: 'मौसम अपडेट: बारिश की चेतावनी',
    thumbnail: 'https://images.unsplash.com/photo-1525088553748-01d6e210e00b?w=600&h=340&fit=crop',
    duration: 45,
    views: 2100000,
    category: 'क्षेत्रीय',
    publishedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    isShort: true,
  },
  {
    id: 'v4',
    title: 'Stock Market: Sensex 75K पार',
    thumbnail: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=600&h=340&fit=crop',
    duration: 135,
    views: 650000,
    category: 'व्यापार',
    publishedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'v5',
    title: 'Bollywood: नई फिल्मों का बॉक्स ऑफिस कलेक्शन',
    thumbnail: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&h=340&fit=crop',
    duration: 180,
    views: 980000,
    category: 'मनोरंजन',
    publishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'v6',
    title: 'Tech Review: iPhone 16 Unboxing',
    thumbnail: 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=600&h=340&fit=crop',
    duration: 600,
    views: 750000,
    category: 'टेक्नोलॉजी',
    publishedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
  },
];

// Video Categories
export const videoCategories: VideoCategory[] = [
  { id: '1', name: 'सभी', nameEn: 'All', slug: 'all' },
  { id: '2', name: 'राष्ट्रीय', nameEn: 'National', slug: 'national' },
  { id: '3', name: 'खेल', nameEn: 'Sports', slug: 'sports' },
  { id: '4', name: 'मनोरंजन', nameEn: 'Entertainment', slug: 'entertainment' },
  { id: '5', name: 'टेक्नोलॉजी', nameEn: 'Technology', slug: 'technology' },
  { id: '6', name: 'व्यापार', nameEn: 'Business', slug: 'business' },
];

// E-Paper Editions
export const epaperEditions: EpaperEdition[] = [
  {
    id: 'delhi',
    name: 'दिल्ली संस्करण',
    nameEn: 'Delhi Edition',
    description: 'दिल्ली-एनसीआर की ताज़ा खबरें',
    descriptionEn: 'Latest news from Delhi-NCR',
    pages: [
      { id: 'p1', name: 'पहला पन्ना', nameEn: 'Front Page', image: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600&h=800&fit=crop' },
      { id: 'p2', name: 'राष्ट्रीय', nameEn: 'National', image: 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=600&h=800&fit=crop' },
      { id: 'p3', name: 'अंतर्राष्ट्रीय', nameEn: 'International', image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&h=800&fit=crop' },
      { id: 'p4', name: 'खेल', nameEn: 'Sports', image: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=600&h=800&fit=crop' },
      { id: 'p5', name: 'मनोरंजन', nameEn: 'Entertainment', image: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&h=800&fit=crop' },
      { id: 'p6', name: 'व्यापार', nameEn: 'Business', image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=600&h=800&fit=crop' },
    ],
  },
  {
    id: 'mumbai',
    name: 'मुंबई संस्करण',
    nameEn: 'Mumbai Edition',
    description: 'मुंबई और महाराष्ट्र की खबरें',
    descriptionEn: 'News from Mumbai and Maharashtra',
    pages: [
      { id: 'p1', name: 'पहला पन्ना', nameEn: 'Front Page', image: 'https://images.unsplash.com/photo-1567157577867-05ccb1388e66?w=600&h=800&fit=crop' },
      { id: 'p2', name: 'महाराष्ट्र', nameEn: 'Maharashtra', image: 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=600&h=800&fit=crop' },
      { id: 'p3', name: 'मुंबई', nameEn: 'Mumbai', image: 'https://images.unsplash.com/photo-1529253355930-ddbe423a2ac7?w=600&h=800&fit=crop' },
    ],
  },
  {
    id: 'patna',
    name: 'पटना संस्करण',
    nameEn: 'Patna Edition',
    description: 'बिहार की ताज़ा खबरें',
    descriptionEn: 'Latest news from Bihar',
    pages: [
      { id: 'p1', name: 'पहला पन्ना', nameEn: 'Front Page', image: 'https://images.unsplash.com/photo-1595658658481-d53d3f999875?w=600&h=800&fit=crop' },
      { id: 'p2', name: 'बिहार', nameEn: 'Bihar', image: 'https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?w=600&h=800&fit=crop' },
    ],
  },
];

const USE_REMOTE_DEMO_MEDIA =
  process.env.NEXT_PUBLIC_USE_REMOTE_DEMO_MEDIA === 'true';
const UNSPLASH_IMAGE_HOST = /^https:\/\/images\.unsplash\.com\//i;
const LOCAL_MOCK_ASSETS = {
  avatar: '/placeholders/avatar.svg',
  media: '/placeholders/news-16x9.svg',
  story: '/placeholders/story-9x16.svg',
  epaper: '/placeholders/epaper-3x4.svg',
};

const resolveMockImage = (src: string, fallback: string) =>
  !USE_REMOTE_DEMO_MEDIA && UNSPLASH_IMAGE_HOST.test(src) ? fallback : src;

authors.forEach((author) => {
  author.avatar = resolveMockImage(author.avatar, LOCAL_MOCK_ASSETS.avatar);
});

stories.forEach((story) => {
  story.thumbnail = resolveMockImage(story.thumbnail, LOCAL_MOCK_ASSETS.story);
});

articles.forEach((article) => {
  article.image = resolveMockImage(article.image, LOCAL_MOCK_ASSETS.media);
  article.author.avatar = resolveMockImage(article.author.avatar, LOCAL_MOCK_ASSETS.avatar);
});

videos.forEach((video) => {
  video.thumbnail = resolveMockImage(video.thumbnail, LOCAL_MOCK_ASSETS.media);
});

epaperEditions.forEach((edition) => {
  edition.pages.forEach((page) => {
    page.image = resolveMockImage(page.image, LOCAL_MOCK_ASSETS.epaper);
  });
});

// Dictionary for translations
export const dictionary = {
  hi: {
    home: 'होम',
    videos: 'वीडियो',
    epaper: 'ई-पेपर',
    quick: 'फटाफट',
    menu: 'मेनू',
    search: 'खोजें',
    breaking: 'ब्रेकिंग',
    readMore: 'और पढ़ें',
    share: 'शेयर करें',
    bookmark: 'सहेजें',
    comments: 'टिप्पणियां',
    related: 'संबंधित खबरें',
    latest: 'ताज़ा खबरें',
    trending: 'ट्रेंडिंग',
    categories: 'श्रेणियाँ',
    pages: 'पेज',
    contact: 'संपर्क करें',
    about: 'हमारे बारे में',
    login: 'लॉग इन',
    logout: 'लॉग आउट',
    admin: 'एडमिन',
    dashboard: 'डैशबोर्ड',
    save: 'सहेजें',
    cancel: 'रद्द करें',
    delete: 'हटाएं',
    edit: 'संपादित करें',
    create: 'बनाएं',
    publish: 'प्रकाशित करें',
    unpublish: 'अप्रकाशित करें',
    loading: 'लोड हो रहा है...',
    noResults: 'कोई परिणाम नहीं मिला',
    tryAgain: 'पुनः प्रयास करें',
    error: 'त्रुटि हुई',
    success: 'सफल',
    minutesAgo: 'मिनट पहले',
    hoursAgo: 'घंटे पहले',
    daysAgo: 'दिन पहले',
  },
  en: {
    home: 'Home',
    videos: 'Videos',
    epaper: 'E-Paper',
    quick: 'Quick',
    menu: 'Menu',
    search: 'Search',
    breaking: 'Breaking',
    readMore: 'Read More',
    share: 'Share',
    bookmark: 'Bookmark',
    comments: 'Comments',
    related: 'Related News',
    latest: 'Latest News',
    trending: 'Trending',
    categories: 'Categories',
    pages: 'Pages',
    contact: 'Contact',
    about: 'About Us',
    login: 'Login',
    logout: 'Logout',
    admin: 'Admin',
    dashboard: 'Dashboard',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    create: 'Create',
    publish: 'Publish',
    unpublish: 'Unpublish',
    loading: 'Loading...',
    noResults: 'No results found',
    tryAgain: 'Try Again',
    error: 'Error occurred',
    success: 'Success',
    minutesAgo: 'minutes ago',
    hoursAgo: 'hours ago',
    daysAgo: 'days ago',
  },
};
