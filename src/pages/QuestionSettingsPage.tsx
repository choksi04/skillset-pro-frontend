import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const competencyLevels = [
  { level: 1, name: 'Beginner', label: 'L1 – Basic Awareness', description: 'Aware of concepts but needs guidance for most tasks.', scoreRange: '0–39' },
  { level: 2, name: 'Intermediate', label: 'L2 – Working Knowledge', description: 'Can perform basic tasks with some supervision.', scoreRange: '40–59' },
  { level: 3, name: 'Advanced', label: 'L3 – Independent', description: 'Works independently on standard tasks and problems.', scoreRange: '60–74' },
  { level: 4, name: 'Expert', label: 'L4 – Advanced', description: 'Handles complex scenarios and mentors others.', scoreRange: '75–89' },
  { level: 5, name: 'Master', label: 'L5 – Expert', description: 'Deep expertise, drives best practices and innovation.', scoreRange: '90–100' },
];

const questionTypes = [
  { type: 'scenario', label: 'Scenario', description: 'Open-ended questions that test practical application of knowledge. Evaluated by AI across multiple dimensions.' },
  { type: 'mcq', label: 'Multiple Choice', description: 'Single-answer questions with 4 options. Auto-scored based on correct answer selection.' },
  { type: 'coding', label: 'Coding', description: 'Problem-solving questions requiring code implementation. AI evaluates correctness, approach, and code quality.' },
];

export default function QuestionSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Question Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure competency levels and question type definitions used across the platform.
        </p>
      </div>

      {/* Competency Levels */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Competency Levels</h3>
        <p className="text-xs text-muted-foreground">
          These levels determine question difficulty and scoring thresholds for skill assessments.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {competencyLevels.map((level) => (
            <Card key={level.level} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px]">Level {level.level}</Badge>
                  <span className="text-[10px] text-muted-foreground font-mono">{level.scoreRange}</span>
                </div>
                <CardTitle className="text-sm mt-1">{level.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground leading-relaxed">{level.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Question Types */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Question Types</h3>
        <p className="text-xs text-muted-foreground">
          Supported question formats for skill assessments.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {questionTypes.map((qt) => (
            <Card key={qt.type}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{qt.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground leading-relaxed">{qt.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Scoring Rules */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Scoring Rules</h3>
        <Card>
          <CardContent className="pt-6 space-y-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong>Skill Score</strong> = Average of all question scores for that skill (0–100 scale).
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong>Level Mapping:</strong> 0–39 → L1, 40–59 → L2, 60–74 → L3, 75–89 → L4, 90–100 → L5.
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong>Final Level:</strong> Manager always has final authority. System score is advisory.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
