using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using BrewPost.Infrastructure.Data;
using BrewPost.Core.Interfaces;
using BrewPost.Infrastructure.Services;
using Amazon.S3;
using Amazon.Extensions.NETCore.Setup;
using DotNetEnv;

// Load .env file from root (go up 2 levels from BrewPost.API)
var envPath = Path.Combine(Directory.GetCurrentDirectory(), "..", "..", ".env");
if (File.Exists(envPath))
{
    Env.Load(envPath);
    Console.WriteLine($"✅ Loaded .env file from: {envPath}");
}
else
{
    Console.WriteLine($"⚠️ .env file not found at: {envPath}");
}

var builder = WebApplication.CreateBuilder(args);

// Add environment variables to configuration - this should take precedence
builder.Configuration.AddEnvironmentVariables();

// Add services to the container
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Add session support for OAuth state management
builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromMinutes(30);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
});

// Configure Entity Framework with PostgreSQL
builder.Services.AddDbContext<BrewPostDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"),
        b => b.MigrationsAssembly("BrewPost.API")));

// Configure JWT Authentication
var jwtSettings = builder.Configuration.GetSection("Jwt");
var secretKey = jwtSettings["SecretKey"] ?? throw new InvalidOperationException("JWT SecretKey not configured");
var key = Encoding.ASCII.GetBytes(secretKey);

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false; // Set to true in production
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(key),
        ValidateIssuer = true,
        ValidIssuer = jwtSettings["Issuer"],
        ValidateAudience = true,
        ValidAudience = jwtSettings["Audience"],
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero
    };
});

builder.Services.AddAuthorization();

// Configure AWS S3
var awsOptions = new AWSOptions
{
    Region = Amazon.RegionEndpoint.GetBySystemName(
        builder.Configuration["REGION"] ?? 
        builder.Configuration["AWS:Region"] ?? 
        "us-east-1")
};

// Add AWS credentials if provided (for local development)
// Try environment variables first (from .env), then fall back to appsettings
var accessKey = builder.Configuration["ACCESS_KEY_ID"] ?? builder.Configuration["AWS:AccessKey"];
var awsSecretKey = builder.Configuration["SECRET_ACCESS_KEY"] ?? builder.Configuration["AWS:SecretKey"];
if (!string.IsNullOrEmpty(accessKey) && !string.IsNullOrEmpty(awsSecretKey))
{
    Console.WriteLine($"✅ AWS credentials loaded - Access Key: {accessKey.Substring(0, 4)}****");
    awsOptions.Credentials = new Amazon.Runtime.BasicAWSCredentials(accessKey, awsSecretKey);
}
else
{
    Console.WriteLine("⚠️ No AWS credentials found in configuration");
}

builder.Services.AddDefaultAWSOptions(awsOptions);
builder.Services.AddAWSService<IAmazonS3>();

// Configure Bedrock client with extended timeout for AI operations
builder.Services.AddSingleton<Amazon.BedrockRuntime.IAmazonBedrockRuntime>(sp =>
{
    var cfg = new Amazon.BedrockRuntime.AmazonBedrockRuntimeConfig
    {
        RegionEndpoint = awsOptions.Region,
        Timeout = TimeSpan.FromMinutes(2)
    };
    return awsOptions.Credentials != null
        ? new Amazon.BedrockRuntime.AmazonBedrockRuntimeClient(awsOptions.Credentials, cfg)
        : new Amazon.BedrockRuntime.AmazonBedrockRuntimeClient(cfg);
});

// Register application services
builder.Services.AddScoped<IJwtService, JwtService>();
builder.Services.AddScoped<IOAuthService, OAuthService>();
builder.Services.AddScoped<IS3Service, S3Service>();
builder.Services.AddScoped<IBedrockService, BedrockService>();
builder.Services.AddScoped<ITrendingService, TrendingService>();
builder.Services.AddHttpClient<IOAuthService, OAuthService>();
builder.Services.AddHttpClient<ITrendingService, TrendingService>();
builder.Services.AddMemoryCache();

// Configure CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:3000", "http://localhost:5173", "http://localhost:8080", "http://localhost:8081") // React dev servers
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("AllowFrontend");
app.UseSession();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
