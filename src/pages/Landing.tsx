import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  Zap,
  Target,
  Calendar,
  ArrowRight,
  Eye,
  Home,
  Settings,
  BarChart3,
  Users,
  FileText,
  Layers,
  Play
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AnimatedDonutChart from '@/components/AnimatedDonutChart';

export const Landing: React.FC = () => {
  const navigate = useNavigate();

  // COMMENTED OUT: Original authentication redirect
  // const handleAuthRedirect = () => {
  //   window.location.href = "https://main.d3rq5op2806z3.amplifyapp.com";
  // };

  // NEW: Direct redirect to /app (bypass authentication)
  const handleAuthRedirect = () => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://98.91.68.101';
    window.location.href = `${backendUrl}/api/auth/login`;
  };

  const handleSignIn = () => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://98.91.68.101';
    window.location.href = `${backendUrl}/api/auth/login`;
  };

  const features = [
    { icon: Sparkles, title: 'AI-Powered Content', description: 'Generate stunning social media posts, blog headers, and marketing content with AI.' },
    { icon: Target,   title: 'Visual Planning',    description: 'Connect and organize your content with intuitive drag-and-drop node planning.' },
    { icon: Calendar, title: 'Smart Scheduling',   description: 'Schedule your content across platforms with intelligent timing suggestions.' }
  ];

  /* ---------- NODE LAYOUT (more spaced) ---------- */
  const NODE_W = 260;
  const NODE_H = 150;
  const positions = [
    { x: 80,  y: 150 },
    { x: 480, y: 150 },
    { x: 880, y: 150 },
  ];

  const sampleNodes = [
    { id: '1', title: 'Marketing Campaigns',     type: 'post' as const,  status: 'published' as const, content: 'Launch our new product line with engaging social media content', connections: ['2'] },
    { id: '2', title: 'Brand Story',            type: 'image' as const, status: 'scheduled' as const, content: 'Visual storytelling through compelling brand imagery',           connections: ['3'] },
    { id: '3', title: 'User Generated Content', type: 'story' as const, status: 'draft' as const,     content: 'Curate and share customer success stories',                   connections: []  },
  ];

  const navigationItems = [
    { icon: Home, label: 'Dashboard', active: false },
    { icon: Layers, label: 'Planning', active: false },
    { icon: Calendar, label: 'Calendar', active: false },
    { icon: BarChart3, label: 'Analytics', active: false },
    { icon: FileText, label: 'Content', active: false },
    { icon: Users, label: 'Team', active: false },
    { icon: Settings, label: 'Settings', active: false }
  ];

  const centerAt = (idx: number) => ({
    cx: positions[idx].x + NODE_W / 2,
    cy: positions[idx].y + NODE_H / 2
  });

  // animate the count every time the element scrolls into view (but avoid overlapping runs)
  const animatingRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const el = document.getElementById('countup') as HTMLSpanElement | null;
    if (!el) return;

    const formatNumber = (n: number) => n.toLocaleString('en-US').replace(/,/g, '.');
    const target = 1080000;
    const duration = 1500; // ms

    const runAnimation = () => {
      if (animatingRef.current) return; // avoid overlapping
      animatingRef.current = true;
      const start = performance.now();

      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
        const current = Math.round(target * eased);
        el.textContent = formatNumber(current);
        if (t < 1) requestAnimationFrame(step);
        else {
          el.textContent = formatNumber(target);
          // small timeout to allow re-triggering when scrolling away and back
          setTimeout(() => { animatingRef.current = false; }, 200);
        }
      };

      requestAnimationFrame(step);
    };

    if ('IntersectionObserver' in window) {
      const obs = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) runAnimation();
        });
      }, { threshold: 0.5 });

      obs.observe(el);
      return () => obs.disconnect();
    }

    // fallback
    runAnimation();
  }, []);

  // animate the SME snapshot rings on scroll into view and reset when out
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const rings = Array.from(document.querySelectorAll<SVGPathElement>('.snapshot-ring'));
    if (!rings.length) return;

    const circumference = 2 * Math.PI * 15.9155; // svg circle approx used in path

    rings.forEach((r) => {
      // set initial dash so they appear empty
      r.style.strokeDasharray = `${circumference}`;
      r.style.strokeDashoffset = `${circumference}`;
      r.style.transition = 'stroke-dashoffset 1s cubic-bezier(.22,.9,.22,1)';
    });

    const animateRing = (r: SVGPathElement) => {
      const pct = Number(r.getAttribute('data-pct') || 0) / 100;
      const offset = circumference * (1 - pct);
      // trigger animation
      requestAnimationFrame(() => { r.style.strokeDashoffset = String(offset); });
    };

    const resetRing = (r: SVGPathElement) => {
      r.style.strokeDashoffset = String(circumference);
    };

    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const target = entry.target as SVGPathElement;
        if (entry.isIntersecting) animateRing(target);
        else resetRing(target);
      });
    }, { threshold: 0.6 });

    rings.forEach(r => obs.observe(r));

    return () => obs.disconnect();
  }, []);

  // animate pricing amounts when the Pricing section scrolls into view
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const elems = Array.from(document.querySelectorAll<HTMLElement>('.pricing-amount'));
    if (!elems.length) return;

    const format = (n:number) => n.toString();

    const animateTo = (el: HTMLElement, target: number, duration = 900) => {
      const start = performance.now();
      const from = Number(el.textContent) || 0;
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        const cur = Math.round(from + (target - from) * eased);
        el.textContent = format(cur);
        if (t < 1) requestAnimationFrame(step);
        else el.textContent = format(target);
      };
      requestAnimationFrame(step);
    };

    const reset = (el: HTMLElement) => { el.textContent = '0'; };

    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const el = entry.target as HTMLElement;
        const target = Number(el.getAttribute('data-target') || 0);
        if (entry.isIntersecting) animateTo(el, target);
        else reset(el);
      });
    }, { threshold: 0.6 });

    elems.forEach(e => obs.observe(e));
    return () => obs.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 relative overflow-hidden">
      {/* snow / ambience (unchanged) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(80)].map((_, i) => (
          <div key={i} className="absolute rounded-full animate-snow opacity-70"
            style={{ left: `${Math.random() * 100}%`, width: `${2 + Math.random() * 4}px`, height: `${2 + Math.random() * 4}px`,
              background: `hsl(var(--primary))`, animationDelay: `${Math.random() * 10}s`,
              animationDuration: `${5 + Math.random() * 15}s`, filter: 'blur(0.5px)' }} />
        ))}
        {[...Array(40)].map((_, i) => (
          <div key={`large-${i}`} className="absolute rounded-full animate-snow-delayed opacity-50"
            style={{ left: `${Math.random() * 100}%`, width: `${4 + Math.random() * 8}px`, height: `${4 + Math.random() * 8}px`,
              background: `linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))`,
              animationDelay: `${Math.random() * 8}s`, animationDuration: `${8 + Math.random() * 12}s`, filter: 'blur(1px)' }} />
        ))}
        {[...Array(20)].map((_, i) => (
          <div key={`glow-${i}`} className="absolute rounded-full animate-float opacity-30"
            style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
              width: `${6 + Math.random() * 12}px`, height: `${6 + Math.random() * 12}px`,
              background: `radial-gradient(circle, hsl(var(--primary)), transparent)`,
              animationDelay: `${Math.random() * 6}s`, animationDuration: `${10 + Math.random() * 10}s`,
              filter: 'blur(2px)', boxShadow: `0 0 ${10 + Math.random() * 20}px hsl(var(--primary))` }} />
        ))}
      </div>

      <div className="absolute inset-0 bg-gradient-conic from-primary/15 via-accent/8 to-primary/15 animate-pulse"></div>
      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-gradient-to-r from-primary/25 to-accent/25 rounded-full blur-3xl animate-float opacity-60"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-gradient-to-l from-accent/25 to-primary/25 rounded-full blur-3xl animate-float-delayed opacity-60"></div>

      {/* Top bar */}
      <header className="relative z-10 px-6 py-8">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img src="/logo.svg" alt="BrewPost" className="w-10 h-10" />
              <div className="absolute -inset-1 bg-gradient-primary rounded-xl opacity-30 blur animate-pulse"></div>
            </div>
            <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">BrewPost</h1>
          </div>

          <Button onClick={handleSignIn} size="sm" variant="outline" className="border-primary/30 hover:border-primary/60 bg-card/50 backdrop-blur-sm">
            Sign In
          </Button>
        </div>
      </header>

      {/* MAIN */}
      <div className="relative z-10 px-6 py-16">
        <div className="max-w-7xl mx-auto">
          {/* HERO */}
          <section className="text-center mb-32">
            <div className="relative max-w-6xl mx-auto">

              {/* >>> “BrewPost” on the horizontal glow belt (centered) <<< */}
              <div className="relative mx-auto mb-10 w-full max-w-5xl h-28">
                {/* glow belt */}
                <div
                  aria-hidden
                  className="absolute inset-0 rounded-full blur-3xl opacity-80"
                  style={{
                    background:
                      'radial-gradient(120% 60% at 50% 50%, hsl(var(--primary)/.32) 0%, hsl(var(--accent)/.16) 45%, transparent 70%)'
                  }}
                />
                {/* heading on top of that glow */}
                  <div className="absolute inset-0 flex items-center justify-center">
  <h1
    className="relative text-6xl md:text-8xl font-extrabold bg-gradient-primary bg-clip-text text-transparent
               drop-shadow-[0_0_18px_hsl(var(--primary)/.35)]"
    style={{
      textShadow:
        '0 0 10px hsl(var(--primary) / .55), 0 0 26px hsl(var(--accent) / .35), 0 0 48px hsl(var(--accent) / .25)'
    }}
  >
    {/* soft pulsing halo behind the letters */}
    <span
      aria-hidden
      className="pointer-events-none absolute -inset-8 -z-10 rounded-full blur-3xl opacity-75 animate-pulse"
      style={{
        background:
          'radial-gradient(closest-side, hsl(var(--primary) / .55), hsl(var(--accent) / .30), transparent 70%)'
      }}
    />
    BrewPost
  </h1>
</div>
              </div>

              <p className="text-lg md:text-xl lg:text-2xl text-muted-foreground mb-12 leading-relaxed max-w-4xl mx-auto">
                Create, plan,and schedule stunning content with AI-powered tools.
                Connect your ideas visually and watch your content strategy come to life with intelligent automation.
              </p>

              <div className="flex gap-8 justify-center flex-wrap mb-16">
                <Button
                  size="lg"
                  onClick={handleAuthRedirect}
                  className="bg-gradient-primary hover:opacity-90 text-lg px-12 py-6 h-auto relative overflow-hidden group transform hover:scale-110 transition-all duration-300 shadow-2xl"
                  style={{ boxShadow: '0 0 40px hsl(var(--primary) / 0.6), 0 0 80px hsl(var(--primary) / 0.3)' }}
                >
                  <span className="relative z-10 flex items-center font-semibold">
                    Start Creating <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-2 transition-transform" />
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                  <div className="absolute -inset-1 bg-gradient-primary opacity-50 blur animate-pulse"></div>
                </Button>

                <Button size="lg" variant="outline" className="border-primary/30 hover:border-primary/60 text-lg px-12 py-6 h-auto relative overflow-hidden group backdrop-blur-sm hover:scale-110 transition-all duration-300 shadow-xl">
                  <span className="relative z-10 flex items-center font-semibold">
                    <Play className="w-5 h-5 mr-2" /> Watch Demo
                  </span>
                  <div className="absolute inset-0 bg-gradient-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="absolute -inset-1 bg-gradient-primary opacity-20 blur group-hover:opacity-40 transition-opacity duration-300"></div>
                </Button>
              </div>

              {/* the 4 small boxes — floating again */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-5xl mx-auto">
                {[
                  { Icon: Sparkles, text: 'AI Powered', delay: 0 },
                  { Icon: Target,   text: 'Visual Planning', delay: 0.2 },
                  { Icon: Calendar, text: 'Smart Schedule',  delay: 0.4 },
                  { Icon: Zap,      text: 'Auto Publish',    delay: 0.6 },
                ].map(({ Icon, text, delay }) => (
                  <div
                    key={text}
                    className="flex items-center gap-3 p-4 bg-card/20 backdrop-blur-sm rounded-xl border border-primary/20 animate-float hover:scale-105 transition-transform"
                    style={{ animationDelay: `${delay}s`, animationDuration: '6s' }}
                  >
                    <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center shadow-lg">
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-sm font-medium">{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* SME MARKETING SNAPSHOT — placed under hero */}
          <section className="mb-32">
            <div className="max-w-7xl mx-auto">
              <h3 className="text-3xl font-bold mb-8">SME Struggling Because of...</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { pct: 67, title: "didn't realize the importance of digital marketing strategy", source: 'Mayple' },
                  { pct: 60, title: 'of marketing budgets are inefficiently wasted', source: 'Proxima' },
                  { pct: 90, title: 'of SMEs are struggling with social media presence', source: 'Blueiris' }
                ].map((s, i) => (
                  <div key={i} className="p-6 bg-card/20 backdrop-blur-sm rounded-2xl border border-primary/10 flex flex-col items-center text-center">
                    <div className="w-36 h-36 mb-4 relative">
                      <svg viewBox="0 0 36 36" className="w-full h-full">
                        <path className="text-muted-foreground" d="M18 2.0845
                          a 15.9155 15.9155 0 0 1 0 31.831
                          a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" strokeOpacity="0.12" strokeWidth="3.5" stroke="currentColor" />
                        <path
                          className="snapshot-ring"
                          data-pct={s.pct}
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          strokeWidth="3.5"
                          stroke={i === 0 ? '#7FFFD4' : i === 1 ? '#33C6FF' : '#2D9CDB'}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-2xl font-bold">{s.pct}%</div>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground mb-4">{s.title}</div>
                    <div className="text-xs text-muted-foreground">Source: {s.source}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* WHY BREWPOST SECTION */}
          <section className="mb-32">
          <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-bold mb-4">Why BrewPost matters</h2>

                {/* Large animated number + caption */}
                <div className="flex items-center gap-8 mb-6">
                  <div className="flex flex-col items-start">
                    <div className="flex items-baseline gap-4">
                      <div className="text-6xl md:text-7xl lg:text-8xl font-extrabold text-foreground leading-tight">
                        {/* number will be rendered here by span with id 'countup' */}
                        <span id="countup" className="bg-gradient-primary bg-clip-text text-transparent">0</span>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground mt-2">96.1% of businesses in Malaysia are SMEs (2024)</div>
                  </div>
                </div>

                {/* Count-up script */}
                {/* We'll render the animated count using a small effect below */}
              </div>

            <div>
              <AnimatedDonutChart slices={[
                { label: 'Food & Beverage', value: 25, color: '#7FFFD4' },
                { label: 'Fashion & Retail', value: 20, color: '#33C6FF' },
                { label: 'Beauty & Wellness', value: 15, color: '#2D9CDB' },
                { label: 'Education', value: 10, color: '#4B7BD3' },
                { label: 'Others', value: 30, color: '#9AA0A6' },
              ]} />
            </div>
          </div>
        </section>

          {/* FEATURES (unchanged visuals) */}
          <section className="mb-32">
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {features.map(({ icon: Icon, title, description }, index) => (
                <Card key={index}
                  className="p-8 bg-card/30 backdrop-blur-md border-border/20 hover:border-primary/40 transition-all duration-500 group relative overflow-hidden transform hover:-translate-y-2 hover:scale-105"
                  style={{ boxShadow: '0 0 30px hsl(var(--primary) / 0.1)' }}>
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-accent/5 to-primary/8 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="absolute -inset-1 bg-gradient-primary opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500"></div>

                  <div className="relative z-10 text-center">
                    <div className="relative mb-6 mx-auto w-16 h-16">
                      <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center relative overflow-hidden shadow-2xl group-hover:scale-110 transition-transform duration-300">
                        <Icon className="w-8 h-8 text-white group-hover:animate-pulse" />
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-sweep"></div>
                      </div>
                    </div>
                    <h3 className="text-xl font-bold mb-4 text-foreground group-hover:text-primary transition-colors">{title}</h3>
                    <p className="text-muted-foreground leading-relaxed text-base">{description}</p>
                  </div>
                </Card>
              ))}
            </div>
          </section>

          {/* VISUAL PLANNING PREVIEW */}
          <section className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <div className="relative">
                <h3 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-primary bg-clip-text text-transparent relative">
                  Visual Planning Preview
                  <div className="absolute inset-0 bg-gradient-primary opacity-20 blur-2xl animate-pulse"></div>
                </h3>
                <div className="absolute -inset-4 bg-gradient-primary opacity-10 blur-3xl animate-pulse"></div>
              </div>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                Experience the power of visual content planning. Watch your ideas connect and flow in real-time.
              </p>
            </div>

            <Card className="p-12 bg-card/20 backdrop-blur-xl border border-primary/20 relative overflow-hidden"
                  style={{ boxShadow: '0 0 20px hsl(var(--primary) / 0.1)' }}>
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent/2 to-primary/5"></div>

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-12">
                  <h4 className="text-2xl font-bold text-foreground relative">
                    Content Network
                    <div className="absolute -bottom-1 left-0 w-full h-0.5 bg-gradient-primary opacity-60"></div>
                  </h4>
                  <Button variant="outline" className="border-primary/30 hover:border-primary/60 bg-card/50 backdrop-blur-sm">
                    <Play className="w-4 h-4 mr-2" />
                    Try Interactive Demo
                  </Button>
                </div>

                {/* wider canvas to allow spacing */}
                <div className="relative h-[440px] min-w-[1200px] bg-gradient-to-br from-background/40 via-primary/3 to-background/40 rounded-2xl p-8 overflow-hidden backdrop-blur-sm border border-primary/5">

                  {/* connectors */}
                  <svg className="absolute inset-0 w-full h-full">
                    <defs>
                      <linearGradient id="glowGradient1" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%"   stopColor="hsl(var(--primary))" stopOpacity="0.9" />
                        <stop offset="50%"  stopColor="hsl(var(--accent))"  stopOpacity="1" />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.9" />
                      </linearGradient>
                      <filter id="glow">
                        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                        <feMerge>
                          <feMergeNode in="coloredBlur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>

                    {sampleNodes.map((n, i) => {
                      const { cx: x1, cy: y1 } = centerAt(i);
                      return n.connections.map((toId) => {
                        const j = sampleNodes.findIndex(s => s.id === toId);
                        if (j === -1) return null;
                        const { cx: x2, cy: y2 } = centerAt(j);
                        const midX = (x1 + x2) / 2;
                        const path = `M ${x1} ${y1} Q ${midX} ${y1 - 70} ${x2} ${y2}`;
                        return (
                          <path key={`${n.id}-${toId}`} d={path}
                                stroke="url(#glowGradient1)" strokeWidth="4" fill="none"
                                filter="url(#glow)" strokeLinecap="round" className="animate-pulse" />
                        );
                      });
                    })}
                  </svg>

                  {/* nodes */}
                  {sampleNodes.map((node, index) => {
                    const TypeIcon = node.type === 'post' ? Target : node.type === 'image' ? Eye : Zap;
                    const statusColors = {
                      published: { bg: 'bg-green-500',         glow: '#10b981' },
                      scheduled: { bg: 'bg-gradient-primary',  glow: 'hsl(var(--primary))' },
                      draft:     { bg: 'bg-gradient-accent',   glow: 'hsl(var(--accent))' }
                    } as const;
                    const colors = statusColors[node.status];

                    return (
                      <div
                        key={node.id}
                        className="absolute bg-card/90 backdrop-blur-sm border border-primary/30 rounded-2xl p-6 shadow-2xl select-none"
                        style={{
                          left: `${positions[index].x}px`,
                          top: `${positions[index].y}px`,
                          width: `${NODE_W}px`,
                          height: `${NODE_H}px`,
                          boxShadow: `0 0 40px ${colors.glow}40, 0 10px 30px rgba(0,0,0,0.3)`
                        }}
                      >
                        <div className="absolute -inset-1 bg-gradient-primary opacity-20 blur-lg rounded-2xl"></div>
                        <div className="relative z-10">
                          <div className="flex items-center gap-3 mb-3">
                            <div className={`w-12 h-12 ${colors.bg} rounded-xl flex items-center justify-center shadow-xl relative overflow-hidden`}>
                              <TypeIcon className="w-6 h-6 text-white" />
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-sweep"></div>
                            </div>
                            <h5 className="text-lg font-bold truncate text-foreground">{node.title}</h5>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed mb-4">{node.content}</p>
                          <Badge
                            variant="secondary"
                            className={`text-sm h-6 px-3 font-medium ${
                              node.status === 'published' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                              node.status === 'scheduled' ? 'bg-primary/20 text-primary border border-primary/30' :
                              'bg-accent/20 text-accent border border-accent/30'
                            }`}
                            style={{ boxShadow:
                              node.status === 'published' ? '0 0 10px #10b98140' :
                              node.status === 'scheduled' ? '0 0 10px hsl(var(--primary) / 0.3)' :
                              '0 0 10px hsl(var(--accent) / 0.3)' }}
                          >
                            {node.status}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          </section>
          {/* PRICING (moved below Content Network) */}
          <section className="mb-32">
            <div className="max-w-7xl mx-auto text-center">
              <h2 className="text-4xl md:text-5xl font-extrabold mb-8">Pricing Plan</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="p-8 bg-card/10 rounded-2xl border border-gray-300/20 dark:border-gray-700/30">
                  <div className="text-sm font-semibold mb-4">Free-tier</div>
                  <div className="text-5xl font-extrabold mb-4">RM <span className="pricing-amount" data-target="0">0</span></div>
                  <ul className="text-left text-sm list-disc pl-6">
                    <li>2 monthly plans</li>
                    <li>4-6 images per month</li>
                    <li>Basic copywriting and visual generating features</li>
                  </ul>
                </div>

                <div className="p-8 bg-gradient-primary rounded-2xl border border-primary/10 transform scale-105 shadow-2xl">
                  <div className="text-sm font-semibold mb-4">SME-tier</div>
                  <div className="text-6xl font-extrabold mb-4">RM <span className="pricing-amount" data-target="60">0</span></div>
                  <ul className="text-left text-sm list-disc pl-6">
                    <li>Unlimited plan</li>
                    <li>8-10 images per month</li>
                    <li>Advanced copywriting & visual generating features</li>
                  </ul>
                </div>

                <div className="p-8 bg-card/10 rounded-2xl border border-gray-300/20 dark:border-gray-700/30">
                  <div className="text-sm font-semibold mb-4">Pro-tier</div>
                  <div className="text-5xl font-extrabold mb-4">RM <span className="pricing-amount" data-target="150">0</span></div>
                  <ul className="text-left text-sm list-disc pl-6">
                    <li>Unlimited plan & image</li>
                    <li>Advanced copywriting & visual generating features</li>
                    <li>Access to one-click posting</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      
    </div>
  );
};

export default Landing;
