// This is a mock service that would be replaced with actual API calls in a real application

export interface Review {
    id: string
    userId: string
    userName: string
    listingId: string
    purchaseId: string
    rating: number
    comment: string
    date: string
  }
  
  // Mock data store
  const reviews: Review[] = [
    {
      id: "review-1",
      userId: "user-1",
      userName: "John D.",
      listingId: "listing-1",
      purchaseId: "purchase-1",
      rating: 5,
      comment:
        "Excellent data quality with high precision. The temperature readings matched perfectly with our own sensors.",
      date: "2023-03-15T10:30:00Z",
    },
    {
      id: "review-2",
      userId: "user-2",
      userName: "Sarah M.",
      listingId: "listing-1",
      purchaseId: "purchase-2",
      rating: 4,
      comment: "Very good data, but occasional gaps in the readings during peak hours.",
      date: "2023-04-02T14:45:00Z",
    },
    {
      id: "review-3",
      userId: "user-3",
      userName: "Michael K.",
      listingId: "listing-2",
      purchaseId: "purchase-3",
      rating: 5,
      comment: "The air quality data is comprehensive and extremely useful for our research project.",
      date: "2023-03-28T09:15:00Z",
    },
  ]
  
  // Get a user's review for a specific purchase
  export function getUserReview(userId: string, purchaseId: string): Review | null {
    return reviews.find((review) => review.userId === userId && review.purchaseId === purchaseId) || null
  }
  
  // Get all reviews for a listing
  export function getListingReviews(listingId: string): Review[] {
    return reviews.filter((review) => review.listingId === listingId)
  }
  
  // Calculate average rating for a listing
  export function getListingAverageRating(listingId: string): { average: number; count: number } {
    const listingReviews = getListingReviews(listingId)
  
    if (listingReviews.length === 0) {
      return { average: 0, count: 0 }
    }
  
    const sum = listingReviews.reduce((total, review) => total + review.rating, 0)
    return {
      average: sum / listingReviews.length,
      count: listingReviews.length,
    }
  }
  
  // Add or update a review
  export function saveReview(review: Omit<Review, "id" | "date">): Review {
    const existingReviewIndex = reviews.findIndex((r) => r.userId === review.userId && r.purchaseId === review.purchaseId)
  
    const newReview = {
      ...review,
      id: existingReviewIndex >= 0 ? reviews[existingReviewIndex].id : `review-${reviews.length + 1}`,
      date: new Date().toISOString(),
    }
  
    if (existingReviewIndex >= 0) {
      // Update existing review
      reviews[existingReviewIndex] = newReview
    } else {
      // Add new review
      reviews.push(newReview)
    }
  
    return newReview
  }
  