"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Star } from "lucide-react"

interface RatingModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (rating: number, comment: string) => void
  purchaseTitle: string
  initialRating?: number
  initialComment?: string
}

export function RatingModal({
  isOpen,
  onClose,
  onSubmit,
  purchaseTitle,
  initialRating = 0,
  initialComment = "",
}: RatingModalProps) {
  const [rating, setRating] = useState<number>(initialRating)
  const [comment, setComment] = useState<string>(initialComment)
  const [hoveredRating, setHoveredRating] = useState<number | null>(null)

  const handleSubmit = () => {
    onSubmit(rating, comment)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rate This Data</DialogTitle>
          <DialogDescription>How would you rate your experience with "{purchaseTitle}"?</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="flex justify-center mb-6">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(null)}
                className="p-1 focus:outline-none"
                aria-label={`Rate ${star} stars out of 5`}
              >
                <Star
                  className={`h-8 w-8 transition-all ${
                    (hoveredRating !== null ? star <= hoveredRating : star <= rating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground"
                  }`}
                />
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <label htmlFor="comment" className="text-sm font-medium">
              Your Review (Optional)
            </label>
            <Textarea
              id="comment"
              placeholder="Share your experience with this data..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between sm:space-x-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={rating === 0} className="mb-2 sm:mb-0">
            Submit Rating
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
