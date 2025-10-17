using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;

namespace BrewPost.Core.Entities;

public class Post
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();
    
    [Required]
    public Guid UserId { get; set; }
    
    public Guid? PlanId { get; set; }
    
    [Required]
    [MaxLength(255)]
    public string Title { get; set; } = string.Empty;
    
    public string? Caption { get; set; }
    
    public string? ImagePrompt { get; set; }
    
    [Column(TypeName = "jsonb")]
    public JsonDocument Platforms { get; set; } = JsonDocument.Parse("[]");
    
    [MaxLength(50)]
    public string Status { get; set; } = "draft";
    
    public DateTime? ScheduledAt { get; set; }
    
    public DateTime? PublishedAt { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    // Navigation properties
    [ForeignKey(nameof(UserId))]
    public virtual User User { get; set; } = null!;
    
    [ForeignKey(nameof(PlanId))]
    public virtual ContentPlan? ContentPlan { get; set; }
    
    public virtual ICollection<GeneratedImage> GeneratedImages { get; set; } = new List<GeneratedImage>();
    public virtual ICollection<Analytics> Analytics { get; set; } = new List<Analytics>();
    public virtual ICollection<Schedule> Schedules { get; set; } = new List<Schedule>();
    public virtual ICollection<PostAsset> PostAssets { get; set; } = new List<PostAsset>();
}