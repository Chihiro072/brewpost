using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;

namespace BrewPost.Core.Entities;

public class Schedule
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();
    
    [Required]
    public Guid PostId { get; set; }
    
    [Required]
    [MaxLength(50)]
    public string Platform { get; set; } = string.Empty;
    
    [Required]
    public DateTime ScheduledTime { get; set; }
    
    [MaxLength(50)]
    public string Status { get; set; } = "pending";
    
    public int AttemptCount { get; set; } = 0;
    
    public DateTime? LastAttemptAt { get; set; }
    
    public string? ErrorMessage { get; set; }
    
    [Column(TypeName = "jsonb")]
    public JsonDocument PublishResult { get; set; } = JsonDocument.Parse("{}");
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    // Navigation properties
    [ForeignKey(nameof(PostId))]
    public virtual Post Post { get; set; } = null!;
}