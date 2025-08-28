import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, Bot } from "lucide-react"

const AIStakingCard = () => {
  return (
    <Card className="p-6 bg-gradient-to-br from-card/50 via-primary/5 to-card/50 backdrop-blur-sm border-border/30 shadow-lg">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-teal-500 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-primary">AI Auto-Staking</h3>
            <p className="text-sm text-muted-foreground">Automatic staking & yield optimization</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Optimization Progress</span>
            <span className="text-sm font-medium">80%</span>
          </div>
          <div className="w-full bg-muted/20 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-primary to-teal-400 h-2 rounded-full transition-all duration-500"
              style={{ width: '80%' }}
            ></div>
          </div>
        </div>

        {/* APY Display */}
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-5 h-5 text-primary" />
          <span className="text-2xl font-bold text-primary">18.1%</span>
          <span className="text-lg text-muted-foreground">APY</span>
          <Badge className="bg-primary/20 text-primary border-primary/30 ml-auto">
            Active
          </Badge>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4 pt-2">
          <div className="text-center">
            <div className="text-lg font-bold text-primary">247</div>
            <div className="text-xs text-muted-foreground">Optimizations</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-primary">+184 XLM</div>
            <div className="text-xs text-muted-foreground">Yield Generated</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-primary">98.5%</div>
            <div className="text-xs text-muted-foreground">Efficiency</div>
          </div>
        </div>
      </div>
    </Card>
  )
}

export default AIStakingCard