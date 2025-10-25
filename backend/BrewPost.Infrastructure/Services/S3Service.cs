using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using BrewPost.Core.Interfaces;

namespace BrewPost.Infrastructure.Services;

public class S3Service : IS3Service
{
    private readonly IAmazonS3 _s3Client;
    private readonly IConfiguration _configuration;
    private readonly ILogger<S3Service> _logger;
    private readonly string _bucketName;

    public S3Service(IAmazonS3 s3Client, IConfiguration configuration, ILogger<S3Service> logger)
    {
        _s3Client = s3Client;
        _configuration = configuration;
        _logger = logger;
        _bucketName = _configuration["S3_BUCKET"] ?? _configuration["AWS:S3BucketName"] ?? "brewpost-assets";
    }

    public async Task<string> UploadFileAsync(Stream fileStream, string fileName, string contentType, string folder = "assets")
    {
        if (!IsValidFileSize(fileStream.Length, 10 * 1024 * 1024)) // 10MB limit
            throw new InvalidOperationException("File size exceeds the maximum allowed size.");

        if (!IsValidFileType(fileName, new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp" }))
            throw new InvalidOperationException("Invalid file type.");

        var uniqueFileName = GenerateUniqueFileName(fileName);
        var s3Key = $"{folder}/{uniqueFileName}";

        var request = new PutObjectRequest
        {
            BucketName = _bucketName,
            Key = s3Key,
            InputStream = fileStream,
            ContentType = contentType,
            ServerSideEncryptionMethod = ServerSideEncryptionMethod.AES256
        };

        await _s3Client.PutObjectAsync(request);
        return s3Key;
    }

    public async Task<List<string>> UploadMultipleFilesAsync(List<(Stream stream, string fileName, string contentType)> files, string folder = "assets")
    {
        var uploadedFiles = new List<string>();
        
        foreach (var (stream, fileName, contentType) in files)
        {
            try
            {
                var s3Key = await UploadFileAsync(stream, fileName, contentType, folder);
                uploadedFiles.Add(s3Key);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading file {FileName}", fileName);
                // Continue with other files, but log the error
            }
        }
        
        return uploadedFiles;
    }

    public async Task<bool> DeleteFileAsync(string s3Key)
    {
        try
        {
            var deleteRequest = new DeleteObjectRequest
            {
                BucketName = _bucketName,
                Key = s3Key
            };

            await _s3Client.DeleteObjectAsync(deleteRequest);
            _logger.LogInformation("File deleted successfully from S3: {S3Key}", s3Key);
            return true;
        }
        catch (AmazonS3Exception ex)
        {
            _logger.LogError(ex, "Error deleting file from S3: {S3Key}", s3Key);
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error deleting file: {S3Key}", s3Key);
            return false;
        }
    }

    public async Task<string> GeneratePresignedUrlAsync(string s3Key, TimeSpan expiration)
    {
        try
        {
            var request = new GetPreSignedUrlRequest
            {
                BucketName = _bucketName,
                Key = s3Key,
                Verb = HttpVerb.GET,
                Expires = DateTime.UtcNow.Add(expiration)
            };

            var presignedUrl = await _s3Client.GetPreSignedURLAsync(request);
            return presignedUrl;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating presigned URL for: {S3Key}", s3Key);
            throw;
        }
    }

    public async Task<bool> FileExistsAsync(string s3Key)
    {
        try
        {
            var request = new GetObjectMetadataRequest
            {
                BucketName = _bucketName,
                Key = s3Key
            };

            await _s3Client.GetObjectMetadataAsync(request);
            return true;
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking if file exists: {S3Key}", s3Key);
            throw;
        }
    }

    public async Task<Stream?> GetFileStreamAsync(string s3Key)
    {
        try
        {
            var request = new GetObjectRequest
            {
                BucketName = _bucketName,
                Key = s3Key
            };

            var response = await _s3Client.GetObjectAsync(request);
            return response.ResponseStream;
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            _logger.LogWarning("File not found in S3: {S3Key}", s3Key);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting file stream from S3: {S3Key}", s3Key);
            throw;
        }
    }

    public string GenerateUniqueFileName(string originalFileName)
    {
        var extension = Path.GetExtension(originalFileName);
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var randomString = Guid.NewGuid().ToString("N")[..8];
        return $"{timestamp}_{randomString}{extension}";
    }

    public bool IsValidFileType(string fileName, string[] allowedTypes)
    {
        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        return allowedTypes.Contains(extension, StringComparer.OrdinalIgnoreCase);
    }

    public bool IsValidFileSize(long fileSize, long maxSizeInBytes)
    {
        return fileSize > 0 && fileSize <= maxSizeInBytes;
    }

    public string GetFileUrl(string s3Key)
    {
        return $"https://{_bucketName}.s3.amazonaws.com/{s3Key}";
    }
}