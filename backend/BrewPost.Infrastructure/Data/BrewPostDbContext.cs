using Microsoft.EntityFrameworkCore;
using BrewPost.Core.Entities;
using System.Text.Json;

namespace BrewPost.Infrastructure.Data;

public class BrewPostDbContext : DbContext
{
    public BrewPostDbContext(DbContextOptions<BrewPostDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users { get; set; }
    public DbSet<SocialAccount> SocialAccounts { get; set; }
    public DbSet<ContentPlan> ContentPlans { get; set; }
    public DbSet<Post> Posts { get; set; }
    public DbSet<Asset> Assets { get; set; }
    public DbSet<Template> Templates { get; set; }
    public DbSet<GeneratedImage> GeneratedImages { get; set; }
    public DbSet<Analytics> Analytics { get; set; }
    public DbSet<Schedule> Schedules { get; set; }
    public DbSet<PostAsset> PostAssets { get; set; }
    public DbSet<Node> Nodes { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Configure table names to match PostgreSQL convention
        modelBuilder.Entity<User>().ToTable("users");
        modelBuilder.Entity<SocialAccount>().ToTable("social_accounts");
        modelBuilder.Entity<ContentPlan>().ToTable("content_plans");
        modelBuilder.Entity<Post>().ToTable("posts");
        modelBuilder.Entity<Asset>().ToTable("assets");
        modelBuilder.Entity<Template>().ToTable("templates");
        modelBuilder.Entity<GeneratedImage>().ToTable("generated_images");
        modelBuilder.Entity<Analytics>().ToTable("analytics");
        modelBuilder.Entity<Schedule>().ToTable("schedules");
        modelBuilder.Entity<PostAsset>().ToTable("post_assets");
        modelBuilder.Entity<Node>().ToTable("nodes");

        // Configure PostAsset composite key
        modelBuilder.Entity<PostAsset>()
            .HasKey(pa => new { pa.PostId, pa.AssetId });

        // Configure unique constraints
        modelBuilder.Entity<User>()
            .HasIndex(u => u.Email)
            .IsUnique();

        modelBuilder.Entity<SocialAccount>()
            .HasIndex(sa => new { sa.Provider, sa.ProviderId })
            .IsUnique();

        // Configure indexes
        modelBuilder.Entity<SocialAccount>()
            .HasIndex(sa => sa.UserId);
        
        modelBuilder.Entity<SocialAccount>()
            .HasIndex(sa => sa.Provider);

        modelBuilder.Entity<ContentPlan>()
            .HasIndex(cp => cp.UserId);
        
        modelBuilder.Entity<ContentPlan>()
            .HasIndex(cp => cp.Status);

        modelBuilder.Entity<Post>()
            .HasIndex(p => p.UserId);
        
        modelBuilder.Entity<Post>()
            .HasIndex(p => p.PlanId);
        
        modelBuilder.Entity<Post>()
            .HasIndex(p => p.Status);
        
        modelBuilder.Entity<Post>()
            .HasIndex(p => p.ScheduledAt);

        modelBuilder.Entity<Asset>()
            .HasIndex(a => a.UserId);
        
        modelBuilder.Entity<Asset>()
            .HasIndex(a => a.FileType);

        modelBuilder.Entity<Template>()
            .HasIndex(t => t.UserId);

        modelBuilder.Entity<GeneratedImage>()
            .HasIndex(gi => gi.PostId);

        modelBuilder.Entity<Analytics>()
            .HasIndex(a => a.PostId);

        modelBuilder.Entity<Schedule>()
            .HasIndex(s => s.PostId);
        
        modelBuilder.Entity<Schedule>()
            .HasIndex(s => s.ScheduledTime);
        
        modelBuilder.Entity<Schedule>()
            .HasIndex(s => s.Status);

        // Configure JSON columns for PostgreSQL
        modelBuilder.Entity<User>()
            .Property(u => u.Preferences)
            .HasColumnType("jsonb");

        modelBuilder.Entity<SocialAccount>()
            .Property(sa => sa.ProfileData)
            .HasColumnType("jsonb");

        modelBuilder.Entity<ContentPlan>()
            .Property(cp => cp.BrandInfo)
            .HasColumnType("jsonb");

        modelBuilder.Entity<Post>()
            .Property(p => p.Platforms)
            .HasColumnType("jsonb");

        modelBuilder.Entity<Asset>()
            .Property(a => a.Metadata)
            .HasColumnType("jsonb");

        modelBuilder.Entity<Template>()
            .Property(t => t.TemplateData)
            .HasColumnType("jsonb");

        modelBuilder.Entity<GeneratedImage>()
            .Property(gi => gi.GenerationParams)
            .HasColumnType("jsonb");

        modelBuilder.Entity<Analytics>()
            .Property(a => a.DetailedMetrics)
            .HasColumnType("jsonb");

        modelBuilder.Entity<Schedule>()
            .Property(s => s.PublishResult)
            .HasColumnType("jsonb");

        // Configure array columns for PostgreSQL
        modelBuilder.Entity<Asset>()
            .Property(a => a.Tags)
            .HasColumnType("text[]");

        // Configure relationships
        ConfigureRelationships(modelBuilder);
    }

    private void ConfigureRelationships(ModelBuilder modelBuilder)
    {
        // User -> SocialAccounts (One-to-Many)
        modelBuilder.Entity<SocialAccount>()
            .HasOne(sa => sa.User)
            .WithMany(u => u.SocialAccounts)
            .HasForeignKey(sa => sa.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // User -> ContentPlans (One-to-Many)
        modelBuilder.Entity<ContentPlan>()
            .HasOne(cp => cp.User)
            .WithMany(u => u.ContentPlans)
            .HasForeignKey(cp => cp.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // User -> Posts (One-to-Many)
        modelBuilder.Entity<Post>()
            .HasOne(p => p.User)
            .WithMany(u => u.Posts)
            .HasForeignKey(p => p.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // ContentPlan -> Posts (One-to-Many)
        modelBuilder.Entity<Post>()
            .HasOne(p => p.ContentPlan)
            .WithMany(cp => cp.Posts)
            .HasForeignKey(p => p.PlanId)
            .OnDelete(DeleteBehavior.SetNull);

        // User -> Assets (One-to-Many)
        modelBuilder.Entity<Asset>()
            .HasOne(a => a.User)
            .WithMany(u => u.Assets)
            .HasForeignKey(a => a.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // User -> Templates (One-to-Many)
        modelBuilder.Entity<Template>()
            .HasOne(t => t.User)
            .WithMany(u => u.Templates)
            .HasForeignKey(t => t.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // Post -> GeneratedImages (One-to-Many)
        modelBuilder.Entity<GeneratedImage>()
            .HasOne(gi => gi.Post)
            .WithMany(p => p.GeneratedImages)
            .HasForeignKey(gi => gi.PostId)
            .OnDelete(DeleteBehavior.Cascade);

        // Template -> GeneratedImages (One-to-Many)
        modelBuilder.Entity<GeneratedImage>()
            .HasOne(gi => gi.Template)
            .WithMany(t => t.GeneratedImages)
            .HasForeignKey(gi => gi.TemplateId)
            .OnDelete(DeleteBehavior.SetNull);

        // Post -> Analytics (One-to-Many)
        modelBuilder.Entity<Analytics>()
            .HasOne(a => a.Post)
            .WithMany(p => p.Analytics)
            .HasForeignKey(a => a.PostId)
            .OnDelete(DeleteBehavior.Cascade);

        // Post -> Schedules (One-to-Many)
        modelBuilder.Entity<Schedule>()
            .HasOne(s => s.Post)
            .WithMany(p => p.Schedules)
            .HasForeignKey(s => s.PostId)
            .OnDelete(DeleteBehavior.Cascade);

        // Post <-> Assets (Many-to-Many through PostAsset)
        modelBuilder.Entity<PostAsset>()
            .HasOne(pa => pa.Post)
            .WithMany(p => p.PostAssets)
            .HasForeignKey(pa => pa.PostId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<PostAsset>()
            .HasOne(pa => pa.Asset)
            .WithMany(a => a.PostAssets)
            .HasForeignKey(pa => pa.AssetId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}