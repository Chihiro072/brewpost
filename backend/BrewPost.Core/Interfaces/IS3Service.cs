namespace BrewPost.Core.Interfaces
{
    public interface IS3Service
    {
        Task<string> UploadFileAsync(Stream fileStream, string fileName, string contentType, string folder = "assets");
        Task<List<string>> UploadMultipleFilesAsync(List<(Stream stream, string fileName, string contentType)> files, string folder = "assets");
        Task<bool> DeleteFileAsync(string s3Key);
        Task<string> GeneratePresignedUrlAsync(string s3Key, TimeSpan expiration);
        Task<bool> FileExistsAsync(string s3Key);
        string GenerateUniqueFileName(string originalFileName);
        bool IsValidFileType(string fileName, string[] allowedTypes);
        bool IsValidFileSize(long fileSize, long maxSizeInBytes);
        string GetFileUrl(string s3Key);
    }
}