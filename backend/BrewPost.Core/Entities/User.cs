using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;

namespace BrewPost.Core.Entities;

public class User
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();
    
    [Required]
    [MaxLength(255)]
    public string Email { get; set; } = string.Empty;
    
    [MaxLength(255)]
    public string? PasswordHash { get; set; }
    
    [MaxLength(100)]
    public string? FirstName { get; set; }
    
    [MaxLength(100)]
    public string? LastName { get; set; }
    
    public string? AvatarUrl { get; set; }
    
    [Column(TypeName = "jsonb")]
    public JsonDocument Preferences { get; set; } = JsonDocument.Parse("{}");
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    
    // Navigation properties
    public virtual ICollection<SocialAccount> SocialAccounts { get; set; } = new List<SocialAccount>();
    public virtual ICollection<ContentPlan> ContentPlans { get; set; } = new List<ContentPlan>();
    public virtual ICollection<Post> Posts { get; set; } = new List<Post>();
    public virtual ICollection<Asset> Assets { get; set; } = new List<Asset>();
    public virtual ICollection<Template> Templates { get; set; } = new List<Template>();
}