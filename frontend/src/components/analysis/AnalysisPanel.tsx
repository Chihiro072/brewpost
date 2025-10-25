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
  Legend
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
  RefreshCw
} from 'lucide-react';
import type { ContentNode } from '@/types/ContentNode';

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
    engagement: Array<{ day: string; likes: number; comments: number; shares: number }>;
    reach: Array<{ week: string; organic: number; hashtag: number; total: number }>;
  };
  insights: {
    strengths: string[];
    improvements: string[];
    recommendations: string[];
  };
  trendingHashtags: Array<{ tag: string; score: number; trend: 'up' | 'down' | 'stable' }>;
}

interface AnalysisPanelProps {
  selectedNode?: ContentNode | null;
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ selectedNode }) => {
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeChart, setActiveChart] = useState<'engagement' | 'reach' | 'scores'>('scores');

  // Mock data for demonstration - will be replaced with real API calls
  const mockAnalysisData: AnalysisData = {
    scores: {
      imageScore: 8.5,
      captionScore: 7.2,
      topicScore: 9.1,
      averageScore: 8.3,
      overallScore: 8.3
    },
    projections: {
      engagement: [
        { day: 'Day 1', likes: 45, comments: 12, shares: 8 },
        { day: 'Day 2', likes: 78, comments: 23, shares: 15 },
        { day: 'Day 3', likes: 120, comments: 35, shares: 22 },
        { day: 'Day 7', likes: 180, comments: 48, shares: 31 },
        { day: 'Day 14', likes: 220, comments: 58, shares: 38 },
        { day: 'Day 30', likes: 280, comments: 72, shares: 45 }
      ],
      reach: [
        { week: 'Week 1', organic: 1200, hashtag: 800, total: 2000 },
        { week: 'Week 2', organic: 1500, hashtag: 1200, total: 2700 },
        { week: 'Week 3', organic: 1800, hashtag: 1500, total: 3300 },
        { week: 'Week 4', organic: 2200, hashtag: 1800, total: 4000 }
      ]
    },
    insights: {
      strengths: [
        'High topic relevance for wine enthusiasts',
        'Strong visual composition and lighting',
        'Effective use of trending hashtags'
      ],
      improvements: [
        'Caption could be more engaging',
        'Add call-to-action for better interaction',
        'Consider posting during peak hours'
      ],
      recommendations: [
        'Use #WineWednesday for better reach',
        'Add wine pairing suggestions',
        'Include user-generated content elements'
      ]
    },
    trendingHashtags: [
      { tag: '#WineLovers', score: 9.2, trend: 'up' },
      { tag: '#CraftWine', score: 8.7, trend: 'up' },
      { tag: '#WineTasting', score: 7.8, trend: 'stable' },
      { tag: '#LocalWinery', score: 8.1, trend: 'up' },
      { tag: '#WineEducation', score: 6.9, trend: 'down' }
    ]
  };

  const loadAnalysis = useCallback(async () => {
    if (!selectedNode) return;

    setIsLoading(true);
    try {
      console.log('Loading analysis for node:', selectedNode.id);
      
      // Send node data directly to the new analyze-node endpoint
      const nodeAnalysisResponse = await fetch(`http://localhost:5044/api/analysis/analyze-node`, {
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
          y: selectedNode.y || 0
        })
      });
      
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
          overallScore: nodeAnalysisResult.overallScore || 0
        },
        projections: {
          engagement: nodeAnalysisResult.projections?.engagement?.data || [],
          reach: nodeAnalysisResult.projections?.reach?.data || []
        },
        insights: {
          strengths: nodeAnalysisResult.insights?.strengths || [],
          improvements: nodeAnalysisResult.insights?.improvements || [],
          recommendations: nodeAnalysisResult.insights?.recommendations || []
        },
        trendingHashtags: [] // Remove trending hashtags completely
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
    if (score >= 8) return 'Excellent';
    if (score >= 6) return 'Good';
    if (score >= 4) return 'Fair';
    return 'Needs Improvement';
  };

  const ScoreCard = ({ title, score, icon: Icon, description }: { 
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
            className="text-xs"
            style={{ 
              borderColor: getScoreColor(score), 
              color: getScoreColor(score),
              backgroundColor: `${getScoreColor(score)}20`
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
            backgroundColor: 'rgba(255,255,255,0.1)'
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
          <h3 className="text-lg font-semibold text-white mb-2">No Content Selected</h3>
          <p className="text-gray-400 text-sm">
            Select a content node to view detailed analysis and performance insights.
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
          <h3 className="text-lg font-semibold text-white mb-2">Analyzing Content</h3>
          <p className="text-gray-400 text-sm">
            AI is evaluating your content performance...
          </p>
        </div>
      </div>
    );
  }

  if (!analysisData) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center">
          <Target className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Analysis Failed</h3>
          <p className="text-gray-400 text-sm mb-4">
            Unable to analyze the selected content.
          </p>
          <Button 
            onClick={loadAnalysis}
            className="bg-[#03624C] hover:bg-[#2CC295] text-white"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry Analysis
          </Button>
        </div>
      </div>
    );
  }

  const chartData = [
    { name: 'Image', score: analysisData?.scores?.imageScore || 0, color: '#00DF81' },
    { name: 'Caption', score: analysisData?.scores?.captionScore || 0, color: '#2CC295' },
    { name: 'Topic', score: analysisData?.scores?.topicScore || 0, color: '#03624C' },
  ];

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Content Analysis</h2>
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
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-[#03624C]/50 text-[#00DF81] hover:bg-[#03624C]/20"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Score Cards */}
      <div className="grid grid-cols-2 gap-3">
        <ScoreCard
          title="Image Quality"
          score={analysisData?.scores?.imageScore || 0}
          icon={ImageIcon}
          description="Visual appeal, composition, and quality"
        />
        <ScoreCard
          title="Caption"
          score={analysisData?.scores?.captionScore || 0}
          icon={Type}
          description="Engagement and clarity of text content"
        />
        <ScoreCard
          title="Topic Relevance"
          score={analysisData?.scores?.topicScore || 0}
          icon={Hash}
          description="Alignment with wine/brewery trends"
        />
        <Card className="bg-gradient-to-br from-[#03624C]/20 to-[#2CC295]/20 border-[#00DF81]/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-[#00DF81]" />
              <span className="text-sm font-medium text-white">Overall Score</span>
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
              Average of all category scores
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
          className={activeChart === 'scores' ? 'bg-[#03624C] text-white' : 'border-[#03624C]/50 text-[#00DF81]'}
        >
          Scores
        </Button>
        <Button
          variant={activeChart === 'engagement' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveChart('engagement')}
          className={activeChart === 'engagement' ? 'bg-[#03624C] text-white' : 'border-[#03624C]/50 text-[#00DF81]'}
        >
          Engagement
        </Button>
        <Button
          variant={activeChart === 'reach' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveChart('reach')}
          className={activeChart === 'reach' ? 'bg-[#03624C] text-white' : 'border-[#03624C]/50 text-[#00DF81]'}
        >
          Reach
        </Button>
      </div>

      {/* Charts */}
      <Card className="bg-slate-900/50 border-[#03624C]/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-lg">
            {activeChart === 'scores' && 'Score Breakdown'}
            {activeChart === 'engagement' && 'Engagement Projections'}
            {activeChart === 'reach' && 'Reach Forecast'}
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
                      borderRadius: '8px'
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
                      borderRadius: '8px'
                    }}
                  />
                  <Line type="monotone" dataKey="likes" stroke="#00DF81" strokeWidth={2} />
                  <Line type="monotone" dataKey="comments" stroke="#2CC295" strokeWidth={2} />
                  <Line type="monotone" dataKey="shares" stroke="#03624C" strokeWidth={2} />
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
                      borderRadius: '8px'
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
            <CardTitle className="text-white text-lg">AI Insights &amp; Recommendations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-[#00DF81] mb-2">Strengths</h4>
              <ul className="space-y-1">
                {(analysisData?.insights?.strengths || []).map((strength, index) => (
                  <li key={index} className="text-sm text-gray-300 flex items-start gap-2">
                    <span className="text-green-400 mt-1">•</span>
                    {strength}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-yellow-400 mb-2">Areas for Improvement</h4>
              <ul className="space-y-1">
                {(analysisData?.insights?.improvements || []).map((improvement, index) => (
                  <li key={index} className="text-sm text-gray-300 flex items-start gap-2">
                    <span className="text-yellow-400 mt-1">•</span>
                    {improvement}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[#2CC295] mb-2">Recommendations</h4>
              <ul className="space-y-1">
                {(analysisData?.insights?.recommendations || []).map((recommendation, index) => (
                  <li key={index} className="text-sm text-gray-300 flex items-start gap-2">
                    <span className="text-[#2CC295] mt-1">•</span>
                    {recommendation}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};