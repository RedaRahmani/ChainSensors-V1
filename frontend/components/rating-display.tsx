import { Star } from "lucide-react"

interface RatingDisplayProps {
  rating: number
  size?: "sm" | "md" | "lg"
  showValue?: boolean
  reviewCount?: number
}

export function RatingDisplay({ rating, size = "md", showValue = true, reviewCount }: RatingDisplayProps) {
  const starSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  }

  const starSize = starSizes[size]

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${starSize} ${
            star <= Math.round(rating) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"
          }`}
        />
      ))}

      {showValue && (
        <span className="text-sm font-medium ml-1">
          {rating.toFixed(1)}
          {reviewCount !== undefined && <span className="text-xs text-muted-foreground ml-1">({reviewCount})</span>}
        </span>
      )}
    </div>
  )
}
