using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BrewPost.Core.Entities;

public class PostAsset
{
    [Required]
    public Guid PostId { get; set; }
    
    [Required]
    public Guid AssetId { get; set; }
    
    [MaxLength(50)]
    public string UsageType { get; set; } = "reference";
    
    // Navigation properties
    [ForeignKey(nameof(PostId))]
    public virtual Post Post { get; set; } = null!;
    
    [ForeignKey(nameof(AssetId))]
    public virtual Asset Asset { get; set; } = null!;
}