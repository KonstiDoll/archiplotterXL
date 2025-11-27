// This is the backend service

export async function uploadImage(image: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", image);

  const response = await fetch("/process_image/", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const blob = await response.blob();
  const imageUrl = URL.createObjectURL(blob);
  return imageUrl;
}
