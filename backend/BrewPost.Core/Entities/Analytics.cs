using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;

namespace BrewPost.Core.Entities;

public class Analytics
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();
    
    [Required]
    public Guid PostId { get; set; }
    
    public int PredictedViews { get; set; } = 0;
    
    public int PredictedLikes { get; set; } = 0;
    
    public int PredictedComments { get; set; } = 0;
    
    [Column(TypeName = "decimal(3,2)")]
    public decimal SentimentScore { get; set; } = 0.0m;
    
    [Column(TypeName = "jsonb")]
    public JsonDocument DetailedMetrics { get; set; } = JsonDocument.Parse("{}");
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    // Navigation properties
    [ForeignKey(nameof(PostId))]
    public virtual Post Post { get; set; } = null!;
}