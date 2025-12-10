import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Target,
  Image as ImageIcon,
  Type,
  Hash,
  BarChart3,
  Download,
  RefreshCw,
} from 'lucide-react';
import type { ContentNode } from '@/types/ContentNode';
import { useLanguage } from '@/contexts/LanguageContext';

interface AnalysisScore {
  imageScore: number;
  captionScore: number;
  topicScore: number;
  averageScore: number;
  overallScore: number;
}

interface AnalysisData {
  scores: AnalysisScore;
  projections: {
    engagement: Array<{
      day: string;
      likes: number;
      comments: number;
      shares: number;
    }>;
    reach: Array<{
      week: string;
      organic: number;
      hashtag: number;
      total: number;
    }>;
  };
  insights: {
    strengths: string[];
    improvements: string[];
    recommendations: string[];
  };
  trendingHashtags: Array<{
    tag: string;
    score: number;
    trend: 'up' | 'down' | 'stable';
  }>;
}

interface AnalysisPanelProps {
  selectedNode?: ContentNode | null;
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
  selectedNode,
}) => {
  const { t } = useLanguage();
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeChart, setActiveChart] = useState<
    'engagement' | 'reach' | 'scores'
  >('scores');

  // Mock data for demonstration - will be replaced with real API calls
  const mockAnalysisData: AnalysisData = {
    scores: {
      imageScore: 8.5,
      captionScore: 7.2,
      topicScore: 9.1,
      averageScore: 8.3,
      overallScore: 8.3,
    },
    projections: {
      engagement: [
        { day: 'Day 1', likes: 45, comments: 12, shares: 8 },
        { day: 'Day 2', likes: 78, comments: 23, shares: 15 },
        { day: 'Day 3', likes: 120, comments: 35, shares: 22 },
        { day: 'Day 7', likes: 180, comments: 48, shares: 31 },
        { day: 'Day 14', likes: 220, comments: 58, shares: 38 },
        { day: 'Day 30', likes: 280, comments: 72, shares: 45 },
      ],
      reach: [
        { week: 'Week 1', organic: 1200, hashtag: 800, total: 2000 },
        { week: 'Week 2', organic: 1500, hashtag: 1200, total: 2700 },
        { week: 'Week 3', organic: 1800, hashtag: 1500, total: 3300 },
        { week: 'Week 4', organic: 2200, hashtag: 1800, total: 4000 },
      ],
    },
    insights: {
      strengths: [
        'High topic relevance for wine enthusiasts',
        'Strong visual composition and lighting',
        'Effective use of trending hashtags',
      ],
      improvements: [
        'Caption could be more engaging',
        'Add call-to-action for better interaction',
        'Consider posting during peak hours',
      ],
      recommendations: [
        'Use #WineWednesday for better reach',
        'Add wine pairing suggestions',
        'Include user-generated content elements',
      ],
    },
    trendingHashtags: [
      { tag: '#WineLovers', score: 9.2, trend: 'up' },
      { tag: '#CraftWine', score: 8.7, trend: 'up' },
      { tag: '#WineTasting', score: 7.8, trend: 'stable' },
      { tag: '#LocalWinery', score: 8.1, trend: 'up' },
      { tag: '#WineEducation', score: 6.9, trend: 'down' },
    ],
  };

  const loadAnalysis = useCallback(async () => {
    if (!selectedNode) return;

    setIsLoading(true);
    try {
      console.log('Loading analysis for node:', selectedNode.id);

      // Send node data directly to the analyze-node endpoint
      const BASE =
        (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:5044';
      const nodeAnalysisResponse = await fetch(
        `${BASE}/api/analysis/analyze-node`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: selectedNode.title || '',
            content: selectedNode.content || '',
            imageUrl: selectedNode.imageUrl || null,
            imageUrls: selectedNode.imageUrls || null,
            imagePrompt: selectedNode.imagePrompt || null,
            type: selectedNode.type || 'post',
            status: selectedNode.status || 'draft',
            x: selectedNode.x || 0,
            y: selectedNode.y || 0,
            preferLanguage:
              document.documentElement.getAttribute('lang') || 'en',
          }),
        }
      );

      if (!nodeAnalysisResponse.ok) {
        throw new Error(`HTTP error! status: ${nodeAnalysisResponse.status}`);
      }

      const nodeAnalysisResult = await nodeAnalysisResponse.json();
      console.log('Node analysis response:', nodeAnalysisResult);

      // Transform the API response to match our AnalysisData interface
      const transformedData: AnalysisData = {
        scores: {
          imageScore: nodeAnalysisResult.imageScore || 0,
          captionScore: nodeAnalysisResult.captionScore || 0,
          topicScore: nodeAnalysisResult.topicScore || 0,
          averageScore: nodeAnalysisResult.overallScore || 0,
          overallScore: nodeAnalysisResult.overallScore || 0,
        },
        projections: {
          engagement: nodeAnalysisResult.projections?.engagement?.data || [],
          reach: nodeAnalysisResult.projections?.reach?.data || [],
        },
        insights: {
          strengths: nodeAnalysisResult.insights?.strengths || [],
          improvements: nodeAnalysisResult.insights?.improvements || [],
          recommendations: nodeAnalysisResult.insights?.recommendations || [],
        },
        trendingHashtags: [], // Remove trending hashtags completely
      };

      setAnalysisData(transformedData);
    } catch (error) {
      console.error('Failed to load analysis:', error);
      // Fallback to mock data if API fails
      setAnalysisData(mockAnalysisData);
    } finally {
      setIsLoading(false);
    }
  }, [selectedNode]);

  useEffect(() => {
    if (selectedNode) {
      loadAnalysis();
    }
  }, [selectedNode, loadAnalysis]);

  const getScoreColor = (score: number): string => {
    if (score >= 8) return '#00DF81';
    if (score >= 6) return '#FFA500';
    return '#FF6B6B';
  };

  const getScoreLabel = (score: number): string => {
    if (score >= 8) return t('analysis.score_label.excellent');
    if (score >= 6) return t('analysis.score_label.good');
    if (score >= 4) return t('analysis.score_label.fair');
    return t('analysis.score_label.needs_improvement');
  };

  const ScoreCard = ({
    title,
    score,
    icon: Icon,
    description,
  }: {
    title: string;
    score: number;
    icon: React.ElementType;
    description: string;
  }) => (
    <Card className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 border-[#03624C]/30">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-[#00DF81]" />
            <span className="text-sm font-medium text-white">{title}</span>
          </div>
          <Badge
            variant="outline"
            className="text-[10px] px-2 py-0.5 rounded-md whitespace-normal break-words leading-3"
            style={{
              borderColor: getScoreColor(score),
              color: getScoreColor(score),
              backgroundColor: `${getScoreColor(score)}20`,
            }}
          >
            {getScoreLabel(score)}
          </Badge>
        </div>
        <div className="flex items-end gap-3">
          <span
            className="text-2xl font-bold"
            style={{ color: getScoreColor(score) }}
          >
            {score.toFixed(1)}
          </span>
          <span className="text-sm text-gray-400 mb-1">/10</span>
        </div>
        <Progress
          value={score * 10}
          className="h-2 mt-2"
          style={{
            backgroundColor: 'rgba(255,255,255,0.1)',
          }}
        />
        <p className="text-xs text-gray-400 mt-2">{description}</p>
      </CardContent>
    </Card>
  );

  if (!selectedNode) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center">
          <BarChart3 className="w-12 h-12 text-[#00DF81]/50 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">
            {t('analysis.no_selected_title')}
          </h3>
          <p className="text-gray-400 text-sm">
            {t('analysis.no_selected_desc')}
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-[#00DF81] animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">
            {t('analysis.loading_title')}
          </h3>
          <p className="text-gray-400 text-sm">{t('analysis.loading_desc')}</p>
        </div>
      </div>
    );
  }

  if (!analysisData) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center">
          <Target className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">
            {t('analysis.failed_title')}
          </h3>
          <p className="text-gray-400 text-sm mb-4">
            {t('analysis.failed_desc')}
          </p>
          <Button
            onClick={loadAnalysis}
            className="bg-[#03624C] hover:bg-[#2CC295] text-white"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {t('analysis.retry')}
          </Button>
        </div>
      </div>
    );
  }

  const chartData = [
    {
      name: 'Image',
      score: analysisData?.scores?.imageScore || 0,
      color: '#00DF81',
    },
    {
      name: 'Caption',
      score: analysisData?.scores?.captionScore || 0,
      color: '#2CC295',
    },
    {
      name: 'Topic',
      score: analysisData?.scores?.topicScore || 0,
      color: '#03624C',
    },
  ];

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">
            {t('analysis.header')}
          </h2>
          <p className="text-sm text-gray-400">{selectedNode.title}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadAnalysis}
            className="border-[#03624C]/50 text-[#00DF81] hover:bg-[#03624C]/20"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {t('analysis.refresh')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-[#03624C]/50 text-[#00DF81] hover:bg-[#03624C]/20"
          >
            <Download className="w-4 h-4 mr-2" />
            {t('analysis.export')}
          </Button>
        </div>
      </div>

      {/* Score Cards */}
      <div className="grid grid-cols-2 gap-3">
        <ScoreCard
          title={t('analysis.image_quality')}
          score={analysisData?.scores?.imageScore || 0}
          icon={ImageIcon}
          description={t('analysis.image_quality')}
        />
        <ScoreCard
          title={t('analysis.caption')}
          score={analysisData?.scores?.captionScore || 0}
          icon={Type}
          description={t('analysis.caption')}
        />
        <ScoreCard
          title={t('analysis.topic_relevance')}
          score={analysisData?.scores?.topicScore || 0}
          icon={Hash}
          description={t('analysis.topic_relevance')}
        />
        <Card className="bg-gradient-to-br from-[#03624C]/20 to-[#2CC295]/20 border-[#00DF81]/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-[#00DF81]" />
              <span className="text-sm font-medium text-white">
                {t('analysis.overall_score')}
              </span>
            </div>
            <div className="flex items-end gap-3">
              <span className="text-3xl font-bold text-[#00DF81]">
                {analysisData?.scores?.overallScore?.toFixed(1) || '0.0'}
              </span>
              <span className="text-sm text-gray-400 mb-1">/10</span>
            </div>
            <Progress
              value={(analysisData?.scores?.overallScore || 0) * 10}
              className="h-3 mt-2"
            />
            <p className="text-xs text-gray-400 mt-2">
              {t('analysis.average_of_categories')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart Toggle */}
      <div className="flex gap-2">
        <Button
          variant={activeChart === 'scores' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveChart('scores')}
          className={
            activeChart === 'scores'
              ? 'bg-[#03624C] text-white'
              : 'border-[#03624C]/50 text-[#00DF81]'
          }
        >
          {t('analysis.toggle_scores')}
        </Button>
        <Button
          variant={activeChart === 'engagement' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveChart('engagement')}
          className={
            activeChart === 'engagement'
              ? 'bg-[#03624C] text-white'
              : 'border-[#03624C]/50 text-[#00DF81]'
          }
        >
          {t('analysis.toggle_engagement')}
        </Button>
        <Button
          variant={activeChart === 'reach' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveChart('reach')}
          className={
            activeChart === 'reach'
              ? 'bg-[#03624C] text-white'
              : 'border-[#03624C]/50 text-[#00DF81]'
          }
        >
          {t('analysis.toggle_reach')}
        </Button>
      </div>

      {/* Charts */}
      <Card className="bg-slate-900/50 border-[#03624C]/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-lg">
            {activeChart === 'scores' && t('analysis.chart_scores')}
            {activeChart === 'engagement' && t('analysis.chart_engagement')}
            {activeChart === 'reach' && t('analysis.chart_reach')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              {activeChart === 'scores' && (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9CA3AF" />
                  <YAxis domain={[0, 10]} stroke="#9CA3AF" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: '1px solid #03624C',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="score" fill="#00DF81" radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
              {activeChart === 'engagement' && (
                <LineChart data={analysisData?.projections?.engagement || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="day" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: '1px solid #03624C',
                      borderRadius: '8px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="likes"
                    stroke="#00DF81"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="comments"
                    stroke="#2CC295"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="shares"
                    stroke="#03624C"
                    strokeWidth={2}
                  />
                </LineChart>
              )}
              {activeChart === 'reach' && (
                <BarChart data={analysisData?.projections?.reach || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="week" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: '1px solid #03624C',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="organic" stackId="a" fill="#00DF81" />
                  <Bar dataKey="hashtag" stackId="a" fill="#2CC295" />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Insights */}
      <div className="grid grid-cols-1 gap-4">
        <Card className="bg-slate-900/50 border-[#03624C]/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg">
              {t('analysis.insights_header')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-[#00DF81] mb-2">
                {t('analysis.strengths')}
              </h4>
              <ul className="space-y-1">
                {(analysisData?.insights?.strengths || []).map(
                  (strength, index) => (
                    <li
                      key={index}
                      className="text-sm text-gray-300 flex items-start gap-2"
                    >
                      <span className="text-green-400 mt-1">•</span>
                      {translateInsight(strength, t)}
                    </li>
                  )
                )}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-yellow-400 mb-2">
                {t('analysis.improvements')}
              </h4>
              <ul className="space-y-1">
                {(analysisData?.insights?.improvements || []).map(
                  (improvement, index) => (
                    <li
                      key={index}
                      className="text-sm text-gray-300 flex items-start gap-2"
                    >
                      <span className="text-yellow-400 mt-1">•</span>
                      {translateInsight(improvement, t)}
                    </li>
                  )
                )}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[#2CC295] mb-2">
                {t('analysis.recommendations')}
              </h4>
              <ul className="space-y-1">
                {(analysisData?.insights?.recommendations || []).map(
                  (recommendation, index) => (
                    <li
                      key={index}
                      className="text-sm text-gray-300 flex items-start gap-2"
                    >
                      <span className="text-[#2CC295] mt-1">•</span>
                      {translateInsight(recommendation, t)}
                    </li>
                  )
                )}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

function translateInsight(
  text: string,
  t: (k: string, p?: Record<string, string | number>) => string
): string {
  const map: Record<string, string> = {
    'Decent caption quality with room for improvement': t(
      'analysis.insight_phrases.caption_room'
    ),
    'Some topic relevance detected': t(
      'analysis.insight_phrases.topic_detected'
    ),
    'Add high-quality images to improve visual appeal': t(
      'analysis.insight_phrases.add_hq_images'
    ),
    'Include more relevant keywords and topic-specific content': t(
      'analysis.insight_phrases.add_keywords'
    ),
    'Consider adding multiple images for better engagement': t(
      'analysis.insight_phrases.add_multiple_images'
    ),
    'Upload professional, high-resolution images': t(
      'analysis.insight_phrases.upload_hr'
    ),
    'Include call-to-action phrases and engaging questions': t(
      'analysis.insight_phrases.add_cta'
    ),
    'Research and use trending keywords in your niche': t(
      'analysis.insight_phrases.research_keywords'
    ),
    'Consider posting during peak engagement hours': t(
      'analysis.insight_phrases.post_peak'
    ),
    'Engage with your audience through comments and responses': t(
      'analysis.insight_phrases.engage_comments'
    ),
  };
  const cleaned = String(text).trim();
  return map[cleaned] || cleaned;
}
