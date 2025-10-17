using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;

namespace BrewPost.Core.Entities;

public class ContentPlan
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();
    
    [Required]
    public Guid UserId { get; set; }
    
    [Required]
    [MaxLength(255)]
    public string Title { get; set; } = string.Empty;
    
    [Required]
    public string Prompt { get; set; } = string.Empty;
    
    [Column(TypeName = "jsonb")]
    public JsonDocument BrandInfo { get; set; } = JsonDocument.Parse("{}");
    
    [MaxLength(50)]
    public string Status { get; set; } = "draft";
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    // Navigation properties
    [ForeignKey(nameof(UserId))]
    public virtual User User { get; set; } = null!;
    
    public virtual ICollection<Post> Posts { get; set; } = new List<Post>();
}